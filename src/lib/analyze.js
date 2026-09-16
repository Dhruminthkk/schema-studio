// Schema Review — analyzes the live schema and emits findings.

import { computeDropSets } from './dropped.js';

const AUDIT_FIELDS = ["created_at", "updated_at", "created_by", "updated_by"];

export function analyzeSchema(rawTables, relationships) {
  // Fields marked for deletion are decisions already taken — reviewing them
  // produces findings about columns that are on their way out, and inflates
  // counts like "table is wide". Same for orphaned fields, whose FK target is
  // marked. Strip both once here so every check below reasons about the
  // surviving model.
  //
  // Primary keys survive the strip even when marked, matching the canvas:
  // removing one here would fire a bogus "has no primary key" finding.
  const dropSets = computeDropSets(rawTables);
  const tables = rawTables.map(t => {
    const live = t.fields.filter(f => !dropSets.hidden.has(f.id));
    return live.length === t.fields.length ? t : { ...t, fields: live };
  });

  const findings = [];

  // ---- 0. Cascade damage. Reported once per affected table rather than per
  // field, so marking one heavily-referenced key doesn't bury the panel. This
  // has to be computed from the RAW tables — the orphans were just stripped.
  const orphansByTable = new Map();
  for (const t of rawTables) {
    const hit = t.fields.filter(f => dropSets.orphaned.has(f.id));
    if (hit.length > 0) orphansByTable.set(t, hit);
  }
  for (const [t, orphans] of orphansByTable) {
    // A dead table gets its own finding below — reporting its orphaned fields
    // as well would just say the same thing twice.
    if (dropSets.deadTableIds.has(t.id)) continue;
    findings.push({
      id: `orphan_${t.id}`,
      severity: "high",
      category: "Integrity",
      title: `${t.name} references ${orphans.length} field(s) marked for deletion`,
      body: `${orphans.map(f => f.name).join(", ")} point at a key that is marked for deletion, so ${orphans.length === 1 ? "it is" : "they are"} orphaned. Either un-mark the target, re-point the reference, or mark ${orphans.length === 1 ? "this field" : "these fields"} too.`,
      target: { table: t.id, field: orphans[0].id },
    });
  }

  // ---- 0b. Dead tables — identity gone, so the whole table is finished.
  for (const t of rawTables) {
    if (!dropSets.deadTableIds.has(t.id)) continue;
    const pks = t.fields.filter(f => f.pk);
    const culprits = pks.filter(f => dropSets.marked.has(f.id) || dropSets.orphaned.has(f.id));
    const viaCascade = culprits.every(f => dropSets.orphaned.has(f.id));
    findings.push({
      id: `dead_${t.id}`,
      severity: "high",
      category: "Integrity",
      title: `${t.name} is dead — its identity is marked for deletion`,
      body: viaCascade
        ? `Its primary key (${culprits.map(f => f.name).join(", ")}) references a field that is marked for deletion, so nothing identifies these rows any more. The whole table goes with it — every table keyed on this one dies too.`
        : `Its primary key (${culprits.map(f => f.name).join(", ")}) is marked for deletion, so nothing identifies these rows any more. If you meant to drop only that column, give the table a different key first.`,
      target: { table: t.id },
    });
  }
  const tableById = Object.fromEntries(tables.map(t => [t.id, t]));

  // Index fields by name to find duplicates across tables
  const fieldNameIndex = {};
  for (const t of tables) {
    for (const f of t.fields) {
      if (!fieldNameIndex[f.name]) fieldNameIndex[f.name] = [];
      fieldNameIndex[f.name].push({ table: t, field: f });
    }
  }

  for (const t of tables) {
    // ---- 1. Missing primary key
    const pks = t.fields.filter(f => f.pk);
    if (pks.length === 0) {
      findings.push({
        id: `pk_${t.id}`,
        severity: "high",
        category: "Integrity",
        title: `${t.name} has no primary key`,
        body: "Every table should have a primary key. Either promote an existing unique field or add a surrogate id.",
        target: { table: t.id },
      });
    }

    // ---- 2. Missing ownership / domain
    if (!t.owningDomain || t.domain === "unassigned") {
      findings.push({
        id: `own_${t.id}`,
        severity: "high",
        category: "Ownership",
        title: `${t.name} has no owning domain`,
        body: "Assign an owning domain. Without ownership, write authority and source-of-truth are ambiguous.",
        target: { table: t.id },
      });
    }

    // ---- 3. Missing audit fields
    const fieldNames = new Set(t.fields.map(f => f.name));
    const missingAudit = AUDIT_FIELDS.filter(a => !fieldNames.has(a));
    // master/transactional tables should have at least created_at + updated_at
    if (t.dataClass === "master" || t.dataClass === "transactional" || t.dataClass === "variant") {
      const missingMin = ["created_at", "updated_at"].filter(a => !fieldNames.has(a));
      if (missingMin.length > 0) {
        findings.push({
          id: `audit_${t.id}`,
          severity: "medium",
          category: "Auditability",
          title: `${t.name} is missing audit fields`,
          body: `${missingMin.join(", ")} not declared. Tables that are written to should track creation and modification.`,
          target: { table: t.id },
        });
      }
    }

    // ---- 4. Field warnings authored on the field itself
    for (const f of t.fields) {
      if (f.warning) {
        findings.push({
          id: `fw_${t.id}_${f.id}`,
          severity: f.warning.severity,
          category: "Placement",
          title: `${t.name}.${f.name}`,
          body: f.warning.message,
          target: { table: t.id, field: f.id },
        });
      }
    }

    // ---- 5. Field count → too many responsibilities
    if (t.fields.length > 25) {
      findings.push({
        id: `wide_${t.id}`,
        severity: "low",
        category: "Cohesion",
        title: `${t.name} is wide`,
        body: `${t.fields.length} fields. Consider splitting it so each table carries one concern and one owner.`,
        target: { table: t.id },
      });
    }

    // ---- 6. Mixing master + transactional flags
    const hasTxnish = t.fields.some(f => /_at$/.test(f.name) && /occurred|posted|shipped|delivered|paid/.test(f.name));
    if (t.dataClass === "master" && hasTxnish) {
      findings.push({
        id: `mix_${t.id}`,
        severity: "medium",
        category: "Cohesion",
        title: `${t.name} mixes master and transactional data`,
        body: "Master tables should not contain event-style timestamps. Move them to a transactional table.",
        target: { table: t.id },
      });
    }
  }

  // ---- 7. Duplicate fields across tables (excluding well-known FKs and audit)
  const wellKnown = new Set([
    ...AUDIT_FIELDS,
    "status", "name", "code", "is_active", "currency",
    // FK columns by convention end in _id, allow when one side is a PK
  ]);
  for (const [name, occurrences] of Object.entries(fieldNameIndex)) {
    if (occurrences.length < 2) continue;
    if (wellKnown.has(name)) continue;
    if (/_id$/.test(name)) continue; // FK-like
    // Skip if any side is the PK in its table
    const isAnyPk = occurrences.some(o => o.field.pk);
    if (isAnyPk) continue;
    findings.push({
      id: `dup_${name}`,
      severity: "low",
      category: "Duplication",
      title: `Field "${name}" appears in ${occurrences.length} tables`,
      body: `Tables: ${occurrences.map(o => o.table.name).join(", ")}. If denormalized intentionally, document; otherwise consider normalizing.`,
      target: { table: occurrences[0].table.id, field: occurrences[0].field.id },
    });
  }

  // ---- 8. Missing FK relationships — *_id fields that don't resolve
  const relSet = new Set();
  for (const r of relationships) {
    relSet.add(`${r.from.table}.${r.from.field}`);
  }
  for (const t of tables) {
    for (const f of t.fields) {
      if (!/_id$/.test(f.name)) continue;
      if (f.pk) continue;
      if (f.fk) continue;
      // Skip polymorphic / generic ref fields
      if (/^(ref_id|source_id)$/.test(f.name)) continue;
      findings.push({
        id: `fk_${t.id}_${f.id}`,
        severity: "medium",
        category: "Integrity",
        title: `${t.name}.${f.name} has no FK`,
        body: `Looks like a foreign key by naming convention but no relationship is declared.`,
        target: { table: t.id, field: f.id },
      });
    }
  }

  // ---- 9. Potential many-to-many — two FKs to different tables, no other content
  for (const t of tables) {
    const fks = t.fields.filter(f => f.fk);
    const nonFkNonAudit = t.fields.filter(f =>
      !f.fk && !f.pk && !AUDIT_FIELDS.includes(f.name)
    );
    if (fks.length === 2 && nonFkNonAudit.length <= 2 && t.fields.length <= 6) {
      const targets = new Set(fks.map(f => f.fk.table));
      if (targets.size === 2) {
        findings.push({
          id: `m2m_${t.id}`,
          severity: "low",
          category: "Modeling",
          title: `${t.name} looks like a junction table`,
          body: `Two FKs to different tables with minimal payload. Confirm whether ${[...targets].map(id => tableById[id]?.name || id).join(" ↔ ")} is correctly modeled as many-to-many.`,
          target: { table: t.id },
        });
      }
    }
  }

  // ---- 10. Naming inconsistency: singular vs plural table names
  const plural = tables.filter(t => /s$/.test(t.name) && !/_status$|address$|class$/.test(t.name));
  const singular = tables.filter(t => !/s$/.test(t.name));
  if (plural.length > 0 && singular.length > 0 && plural.length < singular.length) {
    findings.push({
      id: `naming_plural`,
      severity: "low",
      category: "Naming",
      title: `Inconsistent table naming`,
      body: `Most tables are singular (${singular.length}) but ${plural.length} are plural: ${plural.map(t => t.name).join(", ")}. Pick one convention.`,
      target: plural[0] ? { table: plural[0].id } : null,
    });
  }

  // Sort by severity
  const sev = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => sev[a.severity] - sev[b.severity]);
  return findings;
}

