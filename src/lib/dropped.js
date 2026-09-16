// Disposition sets — who is marked for deletion, and who is collateral damage.
//
// Two distinct ideas that are easy to conflate:
//
//   marked   — someone ticked "Marked for deletion" on this field. A DECISION,
//              stored on the field as `drop: true`, exported, undoable.
//   orphaned — nobody marked this field, but its FK points at a field that is
//              marked (or at one that is itself orphaned). A CONSEQUENCE.
//
// Orphaned state is always DERIVED, never stored. That's the whole point: if it
// were written onto the dependent fields, un-marking the original could not tell
// which dependents it had auto-marked versus which the user marked by hand, and
// the two would desync the first time anyone edited an FK. Deriving it means
// un-marking simply recomputes to empty — there is no state to unwind.
//
// The walk is a fixpoint, not a single pass: dropping `product.id` orphans
// `branch_product.product_id`, and if that field is in turn some other table's
// FK target, the orphaning continues. `seen` doubles as the cycle guard, since
// real FK graphs contain cycles.

// Primary keys are never hidden, even when marked or orphaned: every
// relationship anchored to a PK row would otherwise fall back to the card
// centre, and a hidden PK could not be un-marked from the canvas. Marking one is
// still allowed — it just stays on screen, struck through.
export function computeDropSets(tables) {
  const fieldById = new Map();
  for (const t of tables) {
    for (const f of t.fields) fieldById.set(f.id, f);
  }

  // The decisions.
  const marked = new Set();
  for (const t of tables) {
    for (const f of t.fields) if (f.drop) marked.add(f.id);
  }

  // Reverse FK index: target field id -> ids of fields referencing it.
  const dependents = new Map();
  for (const t of tables) {
    for (const f of t.fields) {
      const target = f.fk?.field;
      if (!target) continue;
      if (!dependents.has(target)) dependents.set(target, []);
      dependents.get(target).push(f.id);
    }
  }

  // Fixpoint walk outward from the marked set.
  const orphaned = new Set();
  const seen = new Set(marked);
  const queue = [...marked];
  while (queue.length > 0) {
    const id = queue.shift();
    for (const dep of dependents.get(id) || []) {
      // Already marked by hand, or already reached — a manual decision outranks
      // a derived one, so it keeps its own styling.
      if (seen.has(dep)) continue;
      seen.add(dep);
      orphaned.add(dep);
      queue.push(dep);
    }
  }

  // What actually disappears from the canvas and from the exports.
  const hidden = new Set();
  for (const id of seen) {
    const f = fieldById.get(id);
    if (f && !f.pk) hidden.add(id);
  }

  // Dead tables. A table whose primary key is marked or orphaned has no identity
  // left, so the whole thing is finished — not just the one field.
  //
  // This is what separates an IDENTIFYING relationship from a plain reference.
  // If `product_tag.product_id` is both its PK and an FK to `product.id`, then
  // dropping `product.id` leaves product_tag's rows unidentifiable and the table
  // is dead. Whereas `branch_product` has its own surrogate `id` and merely
  // references product — it survives losing the link, and only the FK field is
  // struck.
  //
  // No extra walk is needed for the cascade: a dead table's PK is already in
  // `seen`, so the fixpoint above has orphaned everything referencing it, which
  // kills the next table down if that reference is *its* key. Composite keys use
  // `some` — breaking one column of a compound key breaks the identity.
  const deadTableIds = new Set();
  for (const t of tables) {
    const pks = t.fields.filter(f => f.pk);
    if (pks.length > 0 && pks.some(f => seen.has(f.id))) deadTableIds.add(t.id);
  }

  return { marked, orphaned, hidden, deadTableIds };
}
