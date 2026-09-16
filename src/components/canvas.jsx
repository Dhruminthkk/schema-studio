import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { dataClassOf } from '../data/schema.js';
import { groupsOfTable, findFieldGroup } from '../lib/groups.js';

/* ================================================================
   Icons
================================================================ */
export const Icon = {
  Key: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><path d="M10.5 6.5a3 3 0 1 1-2.83 4H6v2H4v2H2v-2.5l5.67-5.67A3 3 0 1 1 10.5 6.5Z"/></svg>,
  Link: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><path d="M6 10a3 3 0 0 0 4.24 0L13 7.24A3 3 0 0 0 8.76 3L8 3.76"/><path d="M10 6a3 3 0 0 0-4.24 0L3 8.76A3 3 0 0 0 7.24 13L8 12.24"/></svg>,
  Plus: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" {...p}><path d="M8 3v10M3 8h10"/></svg>,
  Minus: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" {...p}><path d="M3 8h10"/></svg>,
  Trash: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><path d="M3 4h10M6.5 4V2.5h3V4M5 4l.5 9h5L11 4"/></svg>,
  Fit: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><path d="M2 5V2h3M14 5V2h-3M2 11v3h3M14 11v3h-3"/></svg>,
  Search: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><circle cx="7" cy="7" r="4.5"/><path d="m11 11 3 3" strokeLinecap="round"/></svg>,
  Undo: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><path d="M4 8h6a3 3 0 1 1 0 6H7" strokeLinecap="round"/><path d="m6 5-3 3 3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Redo: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><path d="M12 8H6a3 3 0 1 0 0 6h3" strokeLinecap="round"/><path d="m10 5 3 3-3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Export: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><path d="M3 10v2.5A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V10" strokeLinecap="round"/><path d="M8 2v8M5 5l3-3 3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Import: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><path d="M3 10v2.5A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V10" strokeLinecap="round"/><path d="M8 10V2M5 7l3 3 3-3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Add: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><rect x="2.5" y="3.5" width="11" height="9" rx="1.5"/><path d="M2.5 6h11M8 8.5v2.5M6.75 9.75h2.5" strokeLinecap="round"/></svg>,
  Warn: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><path d="M8 3 1.5 13.5h13L8 3Z" strokeLinejoin="round"/><path d="M8 7v3M8 11.5v.5" strokeLinecap="round"/></svg>,
  Info: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><circle cx="8" cy="8" r="5.5"/><path d="M8 7v4M8 5v.5" strokeLinecap="round"/></svg>,
  Help: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><circle cx="8" cy="8" r="5.5"/><path d="M6.5 6.2a1.6 1.6 0 1 1 1.9 1.7v1.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M8.3 11.2v.4" strokeLinecap="round"/></svg>,
  Check: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><path d="m3 8 3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  X: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" {...p}><path d="m4 4 8 8M12 4l-8 8"/></svg>,
  Chevron: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m5 6 3 3 3-3"/></svg>,
  ChevronRight: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 4 3 4-3 4"/></svg>,
  Rows: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><rect x="2.5" y="3" width="11" height="2.5" rx="0.5"/><rect x="2.5" y="6.75" width="11" height="2.5" rx="0.5"/><rect x="2.5" y="10.5" width="11" height="2.5" rx="0.5"/></svg>,
  Compact: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><rect x="2.5" y="3" width="11" height="3" rx="0.5"/><rect x="2.5" y="7" width="11" height="3" rx="0.5"/><rect x="2.5" y="11" width="11" height="2" rx="0.5"/></svg>,
  Theme: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11"/><path d="M8 2.5a5.5 5.5 0 0 0 0 11" fill="currentColor" stroke="none"/></svg>,
  Layers: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" {...p}><path d="m8 2.5 5.5 3-5.5 3-5.5-3 5.5-3Z"/><path d="m2.5 8.5 5.5 3 5.5-3M2.5 11l5.5 3 5.5-3"/></svg>,
  Curve: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" {...p}><path d="M2 12c4 0 4-8 12-8"/></svg>,
  Angle: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" {...p}><path d="M2 12h6V4h6"/></svg>,
  Magic: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m3 13 8-8M11 3l1 1M3 5l1 1M13 9l1 1M9 13l1 1"/><path d="m11.5 4.5 1 1"/></svg>,
  Tidy: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" {...p}><rect x="2.5" y="2.5" width="5" height="5" rx="1"/><rect x="8.5" y="2.5" width="5" height="5" rx="1"/><rect x="2.5" y="8.5" width="5" height="5" rx="1"/><rect x="8.5" y="8.5" width="5" height="5" rx="1"/></svg>,
  Edit: (p) => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" {...p}><path d="m11 2 3 3-8 8-3.5.5.5-3.5 8-8Z"/><path d="m9 4 3 3"/></svg>,
};

const GROUP_ICONS = {
  "Identity":         "id",
  "Naming":           "ab",
  "Categorization":   "%",
  "Hierarchy":        "/",
  "Location":         "@",
  "Lifecycle":        "→",
  "Audit":            "✓",
  "Subject":          "•",
  "Quantities":       "#",
  "Tracking":         "·",
  "Cache":            "~",
  "Movement":         "↔",
  "Source ref":       "?",
  "Source":           "?",
  "Timing":           "⌛",
  "Classification":   "▪",
  "Contact":          "@",
  "Tax":              "$",
  "Defaults":         "·",
  "Parties":          "&",
  "Totals":           "Σ",
  "Carrier":          "→",
  "Destination":      "→",
  "References":       "→",
  "Keys":             "id",
  "Attributes":       "·",
  "Master attributes":"·",
  "Pricing":          "$",
  "Branch overrides": "Δ",
  "Branches":         "&",
  "Terms":            "$",
  "Scope":            "·",
  "Amount":           "$",
  "Discount":         "%",
  "Restriction":      "!",
  "Street":           "·",
  "Locality":         "·",
  "Quantity & price": "#",
  "Other":            "·",
};

/* ================================================================
   Pan/zoom hook
================================================================ */
export function usePanZoom(hostRef, onBackgroundClick) {
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const panning = useRef(null);
  const drag = useRef({ startX: 0, startY: 0, moved: false });

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const onWheel = (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        setView(v => {
          const factor = Math.exp(-e.deltaY * 0.01);
          const k = Math.min(2.5, Math.max(0.15, v.k * factor));
          const ratio = k / v.k;
          return { k, x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio };
        });
      } else {
        setView(v => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };

    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      if (e.target !== el && !e.target.classList.contains('canvas-stage')) return;
      panning.current = { x: e.clientX, y: e.clientY };
      drag.current = { startX: e.clientX, startY: e.clientY, moved: false };
      el.classList.add('grabbing');
    };
    const onMouseMove = (e) => {
      if (!panning.current) return;
      const dx = e.clientX - panning.current.x;
      const dy = e.clientY - panning.current.y;
      if (Math.abs(e.clientX - drag.current.startX) > 3 || Math.abs(e.clientY - drag.current.startY) > 3) {
        drag.current.moved = true;
      }
      panning.current = { x: e.clientX, y: e.clientY };
      setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
    };
    const onMouseUp = () => {
      if (panning.current && !drag.current.moved && onBackgroundClick) {
        onBackgroundClick();
      }
      panning.current = null;
      el.classList.remove('grabbing');
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [hostRef, onBackgroundClick]);

  return [view, setView];
}

/* ================================================================
   Field row (detail view)
================================================================ */
function FieldRow({
  field, table, onMouseDown, onMouseEnter, onMouseLeave,
  selected, dragging, searchHit, orphaned,
}) {
  const isPk = field.pk;
  const isFk = !!field.fk;
  const constraint =
    isPk ? "pk" :
    isFk ? "fk" :
    field.unique ? "uq" :
    field.indexed ? "ix" : null;

  return (
    <div
      className={[
        "field-row",
        field.warning ? "warn" : "",
        // A hand-made decision and a knock-on consequence read differently:
        // `dropped` is red, `orphaned` amber. A field that is both keeps
        // `dropped`, since the explicit decision is the more important fact.
        field.drop ? "dropped" : orphaned ? "orphaned" : "",
        dragging ? "dragging" : "",
        selected ? "selected" : "",
        searchHit ? "search-hit" : "",
      ].join(" ")}
      title={!field.drop && orphaned
        ? "Orphaned — this field's FK target is marked for deletion"
        : undefined}
      data-field-id={field.id}
      onMouseDown={(e) => onMouseDown(e, table.id, field.id)}
      // The row selects the field on mousedown (so a drag can start from the
      // same gesture), but `click` is a separate event: without this it bubbles
      // to the card and the card's own handler re-selects the whole table on
      // mouse release. Selection is already done — this only stops the bubble.
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={(e) => onMouseEnter(e, table.id, field.id)}
      onMouseLeave={onMouseLeave}
    >
      <span className={`field-marker ${isPk ? "pk" : isFk ? "fk" : ""}`} />
      <span className={`field-name ${!field.nullable ? "required" : ""}`}>
        {field.name}
      </span>
      <span className="field-type">
        <span>{field.type}</span>
        {constraint && <span className={`constraint ${constraint}`}>· {constraint}</span>}
        {field.computed && <span className="field-computed-mark" title={`Computed, not stored: ${field.computed}`}>ƒ</span>}
        {field.warning && <span className="field-warn-mark" title={field.warning.message}>!</span>}
      </span>
    </div>
  );
}

/* ================================================================
   Group row (core view) — plain selectable list item
================================================================ */
function GroupRow({ table, group, selected, searchHit, onSelect, onMouseEnter, onMouseLeave, hasWarning, hasFk, hasPk }) {
  return (
    <div
      className={`group-row ${selected ? "selected" : ""} ${hasWarning ? "has-warn" : ""} ${searchHit ? "search-hit" : ""}`}
      data-group-id={`${table.id}::${group.name}`}
      onClick={(e) => { e.stopPropagation(); onSelect(table.id, group.name); }}
      onMouseEnter={(e) => onMouseEnter(e, table.id, group.name)}
      onMouseLeave={onMouseLeave}
    >
      <span className="group-name">{group.name}</span>
      <span className="group-meta">
        {hasPk && <span className="gm-dot pk" title="contains primary key" />}
        {hasFk && <span className="gm-dot fk" title="contains foreign key" />}
        {group.fields.some(f => f.computed) && (
          <span className="gm-dot computed" title="contains computed fields" />
        )}
        {hasWarning && <span className="gm-dot warn" title="contains warning" />}
      </span>
    </div>
  );
}

/* ================================================================
   Table card
================================================================ */
export function TableCard({
  table, domainMeta, dimensions,
  selected, dim, highlighted, isSearchHit, isDropTarget,
  searchFieldHits, searchQ, orphanedFieldIds, dead,
  dropIndicatorIndex,
  viewMode, // 'core' | 'detail'
  selectedGroupKey, // "tableId::groupName" or null
  onSelectGroup,
  onMouseDownHeader,
  onSelect,
  onFieldMouseDown,
  onFieldMouseEnter, onFieldMouseLeave,
  onGroupMouseEnter,
  onHeaderMouseEnter, onHeaderMouseLeave,
  onAddField, onDelete,
  draggedField,
  selectedFieldId,
}) {
  const domainColor = domainMeta?.color || "var(--d-unassigned)";
  const dc = dataClassOf(table.dataClass);

  const groups = useMemo(() => groupsOfTable(table), [table]);

  const indexOf = useCallback((fId) => table.fields.findIndex(f => f.id === fId), [table.fields]);

  // Build the body content based on view mode
  const body = [];
  if (viewMode === 'detail') {
    for (const g of groups) {
      const groupHasFieldHit = searchQ && g.fields.some(f => searchFieldHits?.has(f.id));
      body.push(
        <div key={`gl_${g.name}`} className={`field-group-label ${groupHasFieldHit ? 'search-hit-group' : ''}`} data-group-id={`${table.id}::${g.name}`}>
          {g.name} <span style={{ color: 'var(--ink-5)', fontWeight: 400, letterSpacing: 0 }}>{g.fields.length}</span>
        </div>
      );
      for (const field of g.fields) {
        const idx = indexOf(field.id);
        const isDragging = draggedField?.fieldId === field.id;
        const showDropAbove = isDropTarget && dropIndicatorIndex === idx;
        const isFieldHit = searchQ && searchFieldHits?.has(field.id);
        if (showDropAbove) body.push(<div key={`di_${idx}`} className="drop-indicator" style={{ position: 'relative', marginTop: -1 }} />);
        body.push(
          <FieldRow key={field.id} field={field} table={table}
            onMouseDown={onFieldMouseDown}
            onMouseEnter={onFieldMouseEnter}
            onMouseLeave={onFieldMouseLeave}
            selected={selectedFieldId === field.id}
            dragging={isDragging}
            searchHit={isFieldHit}
            orphaned={orphanedFieldIds?.has(field.id)}
          />
        );
      }
    }
  } else {
    // Core: render group rows as a plain selectable list — no inline expansion
    for (const g of groups) {
      const key = `${table.id}::${g.name}`;
      const isSelected = selectedGroupKey === key;
      const hasWarning = g.fields.some(f => f.warning);
      const hasPk = g.fields.some(f => f.pk);
      const hasFk = g.fields.some(f => f.fk);
      const isSearchHit = searchQ && g.fields.some(f => searchFieldHits?.has(f.id));
      body.push(
        <GroupRow
          key={`gr_${g.name}`}
          table={table}
          group={g}
          selected={isSelected}
          searchHit={isSearchHit}
          onSelect={onSelectGroup}
          onMouseEnter={onGroupMouseEnter}
          onMouseLeave={onFieldMouseLeave}
          hasWarning={hasWarning}
          hasPk={hasPk}
          hasFk={hasFk}
        />
      );
    }
  }

  return (
    <div
      className={[
        "table-card",
        // Identity gone — its primary key is marked or orphaned. Struck out
        // whole, but deliberately NOT hidden: a table vanishing is far more
        // disorienting than a field vanishing, and you need somewhere to click
        // to un-mark the key that killed it.
        dead ? "dead" : "",
        table.dataClass === 'derived' ? "is-derived" : "",
        selected ? "selected" : "",
        dim ? "dim" : "",
        highlighted ? "highlight" : "",
        isSearchHit ? "search-hit" : "",
        isDropTarget ? "drop-target" : "",
      ].join(" ")}
      style={{ left: table.x, top: table.y }}
      data-table-id={table.id}
      onClick={(e) => { e.stopPropagation(); onSelect(table.id); }}
      ref={(el) => { if (el) dimensions.current.set(table.id, { el }); }}
    >
      <div
        className="table-head"
        onMouseDown={(e) => onMouseDownHeader(e, table.id)}
        onMouseEnter={(e) => onHeaderMouseEnter(e, table.id)}
        onMouseLeave={onHeaderMouseLeave}
      >
        <div className="table-domain-bar" style={{ background: domainColor }} />
        <div className="table-name">{table.name}</div>
        {/* `droppedCount` is attached upstream from the *unfiltered* table, so a
            card never reads as complete while it's hiding rows. Lives in the
            header rather than the meta row so it shows in Core mode too. */}
        {dead && (
          <div
            className="table-dead-badge"
            title="This table's primary key is marked for deletion (directly, or because the key it references is) — its rows have no identity left, so the whole table is finished."
          >
            dead
          </div>
        )}
        {table.droppedCount > 0 && (
          <div
            className="table-dropped-badge"
            title={
              `${table.droppedCount} hidden field(s) — toggle "Dropped" in the toolbar to show them`
              + `\n  ${table.droppedCount - (table.orphanCount || 0)} marked for deletion`
              + (table.orphanCount > 0
                  ? `\n  ${table.orphanCount} orphaned (FK target is marked)`
                  : '')
            }
          >
            −{table.droppedCount}
          </div>
        )}
        {dc && <div className={`table-class-badge ${dc.cssClass}`}>{dc.label}</div>}
        <div className="table-actions">
          <button className="icon-btn" title="Add field" onClick={(e) => { e.stopPropagation(); onAddField(table.id); }}>
            <Icon.Plus />
          </button>
          <button className="icon-btn" title="Delete table" onClick={(e) => { e.stopPropagation(); onDelete(table.id); }}>
            <Icon.Trash />
          </button>
        </div>
      </div>

      {viewMode === 'detail' && (
        <div className="table-meta">
          <div className="meta-chip">
            <span className="swatch" style={{ background: domainColor }} />
            <span>{domainMeta?.name || "—"}</span>
          </div>
          <span style={{ color: "var(--ink-5)" }}>·</span>
          <div className="meta-chip">{table.fields.length} fields · {groups.length} groups</div>
        </div>
      )}

      <div className="field-list">
        {body}
        {isDropTarget && dropIndicatorIndex === table.fields.length && (
          <div className="drop-indicator" style={{ position: 'relative', marginTop: -1 }} />
        )}
        {viewMode === 'detail' && (
          <div className="field-add-row" onClick={(e) => { e.stopPropagation(); onAddField(table.id); }}>
            + add field
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   Position measurement (field rows + group headers)
================================================================ */
export function computeFieldPositions(tables, tableRefs) {
  const map = {};
  for (const t of tables) {
    const entry = tableRefs.current.get(t.id);
    if (!entry || !entry.el) continue;
    const el = entry.el;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const fields = {};
    const groups = {};
    for (const row of el.querySelectorAll('[data-field-id]')) {
      const id = row.getAttribute('data-field-id');
      fields[id] = { y: row.offsetTop + row.offsetHeight / 2 };
    }
    for (const row of el.querySelectorAll('[data-group-id]')) {
      const fullId = row.getAttribute('data-group-id'); // "tableId::groupName"
      const parts = fullId.split('::');
      const gname = parts[1];
      groups[gname] = { y: row.offsetTop + row.offsetHeight / 2 };
    }
    map[t.id] = { x: t.x, y: t.y, w, h, fields, groups, fallbackY: h / 2 };
  }
  return map;
}

/* ================================================================
   Relationship line builders
================================================================ */
function lineCurved(from, to) {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);

  // How far the control points reach out sideways from each endpoint. This
  // used to be |dx| * 0.5 with no ceiling, so an edge spanning 800px threw its
  // controls 400px out and swept a huge arc right across the canvas — the main
  // source of the tangle. Cap it, and pull it in further when the two ends are
  // mostly vertical from each other, which is where the old curve bulged worst.
  const vertical = dy > dx;
  const reach = Math.min(Math.max(dx * 0.4, 26), 130) * (vertical ? 0.55 : 1);

  const cx1 = from.x + (from.side === 'right' ? reach : -reach);
  const cx2 = to.x   + (to.side   === 'right' ? reach : -reach);

  // Near-vertical edges (two cards stacked in the same column) would otherwise
  // leave and re-enter on the same side at almost the same x, drawing a flat
  // hairpin. Easing the controls towards each other's y turns that into a
  // readable S instead.
  if (vertical && dx < 80) {
    const bend = Math.min(dy * 0.3, 90);
    const midY = (from.y + to.y) / 2;
    return `M ${from.x} ${from.y} C ${cx1} ${from.y + (midY > from.y ? bend : -bend)}, `
         + `${cx2} ${to.y + (midY > to.y ? bend : -bend)}, ${to.x} ${to.y}`;
  }
  return `M ${from.x} ${from.y} C ${cx1} ${from.y}, ${cx2} ${to.y}, ${to.x} ${to.y}`;
}

function lineAngled(from, to) {
  // Stub out from each side, then 90° corners with small rounding via arcs
  const stub = 16;
  const r = 8;
  const x1 = from.x;
  const x2 = to.x;
  const sx = from.x + (from.side === 'right' ? stub : -stub);
  const ex = to.x   + (to.side   === 'right' ? stub : -stub);
  const midX = (sx + ex) / 2;
  const y1 = from.y;
  const y2 = to.y;

  // Decide direction of corners
  const goingDown = y2 > y1;
  const rY1 = goingDown ? +r : -r;
  const rY2 = goingDown ? -r : +r;

  // Direction of x movement at each corner
  const dx1 = midX > sx ? +r : -r;
  const dx2 = ex > midX ? +r : -r;

  // Build the path with arc corners. Use 'A r r 0 0 ?' arcs.
  // Sweep flag: 1 for clockwise when going right+down or left+up; 0 otherwise. Simpler: derive sweep based on direction.
  const sweep1 = (dx1 > 0 && rY1 > 0) || (dx1 < 0 && rY1 < 0) ? 0 : 1;
  const sweep2 = (rY2 > 0 && dx2 > 0) || (rY2 < 0 && dx2 < 0) ? 0 : 1;

  // Adjust if the segments are too short for the arc radius
  const hSeg1 = Math.abs(midX - sx);
  const vSeg = Math.abs(y2 - y1);
  const hSeg2 = Math.abs(ex - midX);
  const arcR = Math.min(r, hSeg1 / 2, vSeg / 2, hSeg2 / 2);

  if (arcR < 2) {
    // Too tight — fall back to straight Manhattan
    return `M ${x1} ${y1} L ${sx} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${ex} ${y2} L ${x2} ${y2}`;
  }

  // Build path with rounded corners
  const aDx1 = midX > sx ? +arcR : -arcR;
  const aDy1 = goingDown ? +arcR : -arcR;
  const aDx2 = ex > midX ? +arcR : -arcR;
  const aDy2 = goingDown ? -arcR : +arcR;

  return (
    `M ${x1} ${y1} ` +
    `L ${sx} ${y1} ` +
    `L ${midX - aDx1} ${y1} ` +
    `A ${arcR} ${arcR} 0 0 ${sweep1} ${midX} ${y1 + aDy1} ` +
    `L ${midX} ${y2 - aDy1} ` +  // continue vertical
    `A ${arcR} ${arcR} 0 0 ${sweep2} ${midX + aDx2} ${y2} ` +
    `L ${ex} ${y2} ` +
    `L ${x2} ${y2}`
  );
}

export function RelationshipsLayer({ tables, relationships, positions, highlightTableId, hoveredTableId, lineStyle, mode = 'background' }) {
  // `mode === 'background'` renders non-active relationships UNDER the table
  // cards (the default canvas appearance). `mode === 'foreground'` renders
  // only the active (highlighted/hovered) relationships, on a separate SVG
  // mounted ABOVE the table cards so the active line can be traced end-to-end
  // without disappearing behind any card it passes through.
  const builder = lineStyle === 'angled' ? lineAngled : lineCurved;
  const paths = [];
  const ends = [];
  // Each layer needs its own marker IDs so the two SVGs don't collide.
  const mkId = (name) => `${name}-${mode === 'foreground' ? 'fg' : 'bg'}`;

  for (const r of relationships) {
    const fromT = positions[r.from.table];
    const toT = positions[r.to.table];
    if (!fromT || !toT) continue;

    // Anchor: prefer field row → group header → card center
    let fromY;
    if (fromT.fields[r.from.field]) {
      fromY = fromT.fields[r.from.field].y;
    } else {
      // Find which group contains this field
      const ft = tables.find(t => t.id === r.from.table);
      const gname = ft ? findFieldGroup(ft, r.from.field) : null;
      if (gname && fromT.groups[gname]) fromY = fromT.groups[gname].y;
      else fromY = fromT.fallbackY;
    }
    let toY;
    if (toT.fields[r.to.field]) {
      toY = toT.fields[r.to.field].y;
    } else {
      const tt = tables.find(t => t.id === r.to.table);
      const gname = tt ? findFieldGroup(tt, r.to.field) : null;
      if (gname && toT.groups[gname]) toY = toT.groups[gname].y;
      else toY = toT.fallbackY;
    }

    const fromCenterX = fromT.x + fromT.w / 2;
    const toCenterX   = toT.x   + toT.w   / 2;
    const fromSide = fromCenterX < toCenterX ? 'right' : 'left';
    const toSide   = fromSide === 'right' ? 'left' : 'right';

    const from = {
      x: fromT.x + (fromSide === 'right' ? fromT.w : 0),
      y: fromT.y + fromY,
      side: fromSide,
    };
    const to = {
      x: toT.x + (toSide === 'right' ? toT.w : 0),
      y: toT.y + toY,
      side: toSide,
    };

    const isHi = highlightTableId && (r.from.table === highlightTableId || r.to.table === highlightTableId);
    const isHover = hoveredTableId && (r.from.table === hoveredTableId || r.to.table === hoveredTableId);
    const isActive = isHi || isHover;
    // Layer split — each path appears in exactly ONE of the two layers,
    // never both, so there's no double-drawing.
    if (mode === 'background' && isActive) continue;
    if (mode === 'foreground' && !isActive) continue;
    const isDim = !!highlightTableId && !isActive;
    const cls = isActive ? "rel-path highlight" : (isDim ? "rel-path dim" : "rel-path");
    const labelCls = isActive ? "rel-label highlight" : "rel-label";

    const markerSuffix = isActive ? '-hi' : (isDim ? '-dim' : '');
    paths.push(
      <path
        key={r.id}
        className={cls}
        d={builder(from, to)}
        markerStart={`url(#${mkId('rel-source' + markerSuffix)})`}
        markerEnd={`url(#${mkId('rel-arrow' + markerSuffix)})`}
      />
    );

    // Cardinality labels — only emit when this relationship is active, so
    // the default canvas stays clean. The arrowhead handles direction; these
    // labels add the multiplicity (N:1, 1:1, etc.). Positioned slightly off
    // the line so the halo (CSS paint-order trick) keeps them readable.
    if (isActive) {
      const labelOffset = 18;
      const endXFrom = from.x + (fromSide === 'right' ? labelOffset : -labelOffset);
      const endXTo   = to.x   + (toSide   === 'right' ? labelOffset : -labelOffset);
      ends.push(
        <g key={`${r.id}_ends`}>
          <text className={labelCls} x={endXFrom} y={from.y - 8} textAnchor={fromSide === 'right' ? 'start' : 'end'}>
            {r.type?.split(':')[0] || 'N'}
          </text>
          <text className={labelCls} x={endXTo} y={to.y - 8} textAnchor={toSide === 'right' ? 'start' : 'end'}>
            {r.type?.split(':')[1] || '1'}
          </text>
        </g>
      );
    }
  }

  // Empty foreground layer renders nothing — saves DOM nodes when nothing
  // is selected.
  if (mode === 'foreground' && paths.length === 0) return null;

  return (
    <svg
      className="rels-svg"
      data-layer={mode}
      style={{ width: 6000, height: 4000, overflow: 'visible' }}
    >
      <defs>
        <marker id={mkId('rel-source')} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5">
          <circle cx="5" cy="5" r="3" className="rel-marker-source" />
        </marker>
        <marker id={mkId('rel-source-hi')} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6">
          <circle cx="5" cy="5" r="3.5" className="rel-marker-source-hi" />
        </marker>
        <marker id={mkId('rel-source-dim')} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5">
          <circle cx="5" cy="5" r="3" className="rel-marker-source-dim" />
        </marker>

        <marker id={mkId('rel-arrow')} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 0 1.5 L 9 5 L 0 8.5 Z" className="rel-marker-arrow" />
        </marker>
        <marker id={mkId('rel-arrow-hi')} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
          <path d="M 0 1.5 L 9 5 L 0 8.5 Z" className="rel-marker-arrow-hi" />
        </marker>
        <marker id={mkId('rel-arrow-dim')} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 0 1.5 L 9 5 L 0 8.5 Z" className="rel-marker-arrow-dim" />
        </marker>
      </defs>
      {paths}
      {ends}
    </svg>
  );
}

