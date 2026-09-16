// Layout algorithms — overlap resolution + connection-aware auto-arrange.
// New design: 3-zone layered layout
//   Zone 0: Master & Reference tables (left)
//   Zone 1: Variant / Junction / Config tables (middle)
//   Zone 2: Transactional / Derived / Output tables (right)
// Within each zone, tables stack vertically and are barycenter-sorted to
// minimize line crossings against adjacent zones.

const PAD_X = 130;       // horizontal gap between zones — also the room edges
                         // get to travel without crossing a card
const PAD_Y = 52;        // vertical gap between tables in a zone
const GRID = 8;          // snap to 8px

function snap(v) { return Math.round(v / GRID) * GRID; }

export function zoneOfTable(t) {
  const c = t.dataClass;
  if (c === "master" || c === "reference") return 0;
  if (c === "variant" || c === "config") return 1;
  return 2; // transactional, derived, junction, unclassified
}

/**
 * Resolve overlaps iteratively without changing the overall arrangement much.
 * tables: [{id, x, y}], sizes: { [id]: {w, h} }
 * Returns: { [id]: {x, y} }
 */
export function resolveOverlaps(tables, sizes, opts = {}) {
  const pad = opts.pad ?? 36;
  const iters = opts.iterations ?? 120;

  const nodes = tables.map(t => ({
    id: t.id,
    x: t.x, y: t.y,
    w: sizes[t.id]?.w ?? 240,
    h: sizes[t.id]?.h ?? 200,
  }));

  for (let iter = 0; iter < iters; iter++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const acx = a.x + a.w / 2, acy = a.y + a.h / 2;
        const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
        const dx = bcx - acx;
        const dy = bcy - acy;
        const minDx = (a.w + b.w) / 2 + pad;
        const minDy = (a.h + b.h) / 2 + pad;
        const overlapX = minDx - Math.abs(dx);
        const overlapY = minDy - Math.abs(dy);
        if (overlapX > 0 && overlapY > 0) {
          if (overlapX < overlapY) {
            const push = overlapX / 2 + 0.5;
            if (dx >= 0) { a.x -= push; b.x += push; }
            else         { a.x += push; b.x -= push; }
          } else {
            const push = overlapY / 2 + 0.5;
            if (dy >= 0) { a.y -= push; b.y += push; }
            else         { a.y += push; b.y -= push; }
          }
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  const out = {};
  for (const n of nodes) out[n.id] = { x: snap(n.x), y: snap(n.y) };
  return out;
}

/**
 * Connection-aware 3-zone layered layout with barycenter sort.
 */
export function autoArrange(tables, relationships, sizes) {
  // 1. Bucket tables by zone
  const zones = [[], [], []];
  for (const t of tables) {
    zones[zoneOfTable(t)].push(t);
  }

  // 2. Build adjacency: for each table, which other tables does it touch?
  const neighbours = {};
  for (const t of tables) neighbours[t.id] = new Set();
  for (const r of relationships) {
    neighbours[r.from.table]?.add(r.to.table);
    neighbours[r.to.table]?.add(r.from.table);
  }

  // 3. Initial ordering: within each zone, group same-domain tables together
  //    (the domain vocabulary is the schema's own, so the order is alphabetical
  //    rather than a ranked list), then by connection count descending.
  const degree = {};
  for (const t of tables) degree[t.id] = neighbours[t.id]?.size ?? 0;

  const domainRank = (d) => d || "\uffff";
  for (const z of zones) {
    z.sort((a, b) => {
      const dr = domainRank(a.domain).localeCompare(domainRank(b.domain));
      if (dr !== 0) return dr;
      return (degree[b.id] || 0) - (degree[a.id] || 0);
    });
  }

  // 4. Compute initial vertical positions per zone, just stacking
  const colX = [];
  let cursorX = 80;
  for (let z = 0; z < zones.length; z++) {
    colX[z] = cursorX;
    // Use the widest card in this zone for column width
    let maxW = 240;
    for (const t of zones[z]) {
      maxW = Math.max(maxW, sizes[t.id]?.w ?? 240);
    }
    cursorX += maxW + PAD_X;
  }

  const positions = {};
  for (let z = 0; z < zones.length; z++) {
    let cy = 80;
    for (const t of zones[z]) {
      positions[t.id] = { x: colX[z], y: cy };
      cy += (sizes[t.id]?.h ?? 200) + PAD_Y;
    }
  }

  // 5. Barycenter sort passes — reorder each zone by the average Y of its
  //    connected neighbours in adjacent zones. Repeat a few times.
  const SWEEPS = 6;
  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    for (let z = 0; z < zones.length; z++) {
      const ts = zones[z];
      // Compute barycenter for each table
      const bary = new Map();
      for (const t of ts) {
        let total = 0, count = 0;
        for (const nbId of neighbours[t.id]) {
          const np = positions[nbId];
          if (!np) continue;
          const nbT = tables.find(x => x.id === nbId);
          const nbH = sizes[nbId]?.h ?? 200;
          // Only consider neighbours in adjacent zones for stronger pull
          const nz = nbT ? zoneOfTable(nbT) : z;
          if (Math.abs(nz - z) <= 1) {
            total += np.y + nbH / 2;
            count++;
          }
        }
        bary.set(t.id, count > 0 ? total / count : (positions[t.id].y + (sizes[t.id]?.h ?? 200) / 2));
      }
      // Stable sort by barycenter
      ts.sort((a, b) => bary.get(a.id) - bary.get(b.id));
      // Re-layout column based on new order, snug stacking
      let cy = 80;
      for (const t of ts) {
        positions[t.id] = { x: colX[z], y: cy };
        cy += (sizes[t.id]?.h ?? 200) + PAD_Y;
      }
    }
  }

  // 6. Final overlap resolution (cheap — should already be non-overlapping)
  const stub = tables.map(t => ({ id: t.id, x: positions[t.id].x, y: positions[t.id].y }));
  const fixed = resolveOverlaps(stub, sizes, { pad: 36, iterations: 60 });

  // 7. Shift so top-left is positive
  let minX = Infinity, minY = Infinity;
  for (const id in fixed) {
    minX = Math.min(minX, fixed[id].x);
    minY = Math.min(minY, fixed[id].y);
  }
  const shift = { x: 80 - minX, y: 80 - minY };
  const out = {};
  for (const id in fixed) {
    out[id] = { x: snap(fixed[id].x + shift.x), y: snap(fixed[id].y + shift.y) };
  }
  return out;
}


/**
 * Reduce edge crossings without rearranging the model.
 *
 * `resolveOverlaps` only stops cards sitting on top of each other; it will
 * happily leave two connected tables at opposite ends of a column with their
 * edge cutting diagonally across everything between them. Auto-arrange fixes
 * that but discards the authored positions, which usually carry intent.
 *
 * This is the middle ground. It finds the columns the cards already form, and
 * within each column only permutes their vertical order — using the same
 * barycenter rule as auto-arrange, where a card wants to sit level with the
 * average of whatever it connects to elsewhere. The columns, their x positions
 * and their membership are all left exactly as they were.
 *
 * positions: { [id]: {x, y} } — treated as read-only; a new object is returned.
 */
export function reduceCrossings(tables, relationships, sizes, positions) {
  const at = (id) => positions[id];
  const heightOf = (id) => sizes[id]?.h ?? 200;

  // 1. Cluster into columns. Two cards share a column when their horizontal
  //    spans line up closely — the same test the eye makes.
  const sorted = [...tables].filter(t => at(t.id)).sort((a, b) => at(a.id).x - at(b.id).x);
  const columns = [];
  for (const t of sorted) {
    const x = at(t.id).x;
    const w = sizes[t.id]?.w ?? 240;
    const col = columns.find(c => Math.abs(c.x - x) < Math.max(60, w * 0.5));
    if (col) { col.items.push(t); col.x = (col.x * (col.items.length - 1) + x) / col.items.length; }
    else columns.push({ x, items: [t] });
  }

  const colOf = new Map();
  columns.forEach((c, i) => c.items.forEach(t => colOf.set(t.id, i)));

  const neighbours = {};
  for (const t of tables) neighbours[t.id] = new Set();
  for (const r of relationships) {
    neighbours[r.from.table]?.add(r.to.table);
    neighbours[r.to.table]?.add(r.from.table);
  }

  const next = {};
  for (const id in positions) next[id] = { ...positions[id] };

  // 2. A few sweeps, so an ordering settled in one column can inform the next.
  for (let sweep = 0; sweep < 4; sweep++) {
    for (const col of columns) {
      if (col.items.length < 2) continue;

      // Keep the column's existing top edge and its tightest real gap, so the
      // pass reorders without drifting the layout up, down or apart.
      const stack = col.items
        .map(t => ({ y: next[t.id].y, h: heightOf(t.id) }))
        .sort((a, b) => a.y - b.y);
      const top = stack[0].y;
      const observed = [];
      for (let i = 1; i < stack.length; i++) {
        observed.push(stack[i].y - (stack[i - 1].y + stack[i - 1].h));
      }
      const real = observed.filter(g => g > 0);
      const gap = real.length ? Math.max(PAD_Y, Math.min(...real)) : PAD_Y;

      const bary = new Map();
      for (const t of col.items) {
        let total = 0, count = 0;
        for (const nb of neighbours[t.id]) {
          if (colOf.get(nb) === colOf.get(t.id)) continue; // same column pulls nowhere
          const np = next[nb];
          if (!np) continue;
          total += np.y + heightOf(nb) / 2;
          count++;
        }
        // No outside connection: stay where it is, so unconnected cards do not
        // all collapse to the top of the column.
        bary.set(t.id, count > 0 ? total / count : next[t.id].y + heightOf(t.id) / 2);
      }

      const ordered = [...col.items].sort((a, b) => bary.get(a.id) - bary.get(b.id));
      let cy = top;
      for (const t of ordered) {
        next[t.id].y = snap(cy);
        cy += heightOf(t.id) + gap;
      }
    }
  }

  // 3. The reorder can only have changed vertical order within a column, but
  //    columns differ in height, so make sure nothing collided across them.
  //
  //    A transpose step was tried here — swapping adjacent pairs and keeping
  //    the swap when it removed a crossing — and measured worse: 0 crossings
  //    to 2 on the minimal schema, 9 to 10 on e-commerce. It scores candidates
  //    on straight centre-to-centre segments, but the drawn edges leave from a
  //    field row on a card's left or right edge, so it was optimising a shape
  //    the user never sees. Barycenter alone measured better on three of the
  //    four bundled schemas.
  const stub = tables.filter(t => next[t.id]).map(t => ({ id: t.id, x: next[t.id].x, y: next[t.id].y }));
  return resolveOverlaps(stub, sizes, { pad: 36, iterations: 60 });
}
