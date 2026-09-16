import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { domainsOf, domainMetaOf, dataClassOf, dataClassOptions } from '../data/schema.js';
import { groupsOfTable } from '../lib/groups.js';
import { Icon } from './canvas.jsx';

/* ================================================================
   Tooltip — context-rich hover for tables and fields
================================================================ */
export function Tooltip({ data }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef(null);

  useEffect(() => {
    if (!data) return;
    // Position to the right of the anchor; flip if it would overflow
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let x = data.anchorX + 16;
    let y = data.anchorY + 8;
    if (x + w > window.innerWidth - 12) x = data.anchorX - w - 16;
    if (y + h > window.innerHeight - 12) y = window.innerHeight - h - 12;
    if (y < 12) y = 12;
    setPos({ x, y });
  }, [data]);

  if (!data) return null;

  return (
    <div ref={ref} className={`tooltip ${data ? 'show' : ''}`} style={{ left: pos.x, top: pos.y }}>
      <div className="tooltip-head">
        <div className="tooltip-title">{data.title}</div>
        {data.pill && <div className="tooltip-pill">{data.pill}</div>}
      </div>
      {data.description && (
        <div className="tooltip-section">{data.description}</div>
      )}
      {data.purpose && (
        <div className="tooltip-section">
          <div className="tooltip-label">Purpose</div>
          {data.purpose}
        </div>
      )}
      {data.example && (
        <div className="tooltip-section">
          <div className="tooltip-label">Example</div>
          <span className="mono" style={{ fontSize: 11 }}>{data.example}</span>
        </div>
      )}
      {data.legacy && (
        <div className="tooltip-section">
          <div className="tooltip-label">Legacy source</div>
          <span className="mono" style={{ fontSize: 11 }}>{data.legacy}</span>
        </div>
      )}
      {data.ownership && (
        <div className="tooltip-section">
          <div className="tooltip-label">Ownership</div>
          {data.ownership}
        </div>
      )}
      {data.conversationPoint && (
        <div className="tooltip-section" style={{ borderLeft: '2px solid var(--accent)', paddingLeft: 8 }}>
          <div className="tooltip-label" style={{ color: 'var(--accent)' }}>Open question</div>
          {data.conversationPoint}
        </div>
      )}
      {data.warning && (
        <div className="tooltip-warn">
          <Icon.Warn />
          <div>{data.warning}</div>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Inspector panel — table or field details
================================================================ */
export function InspectorPanel({ selection, schema, onPatchTable, onPatchField, onDeleteField, onSetGroupDrop }) {
  if (!selection) {
    return (
      <div className="panel-empty">
        <Icon.Info style={{ display: 'block', margin: '0 auto' }} />
        <div>Select a table or field to inspect</div>
        <div style={{ fontSize: 11, marginTop: 8, color: 'var(--ink-5)' }}>
          Hover anything for quick context.<br/>
          Drag fields between tables to rehome ownership.
        </div>
      </div>
    );
  }

  if (selection.type === 'table') {
    const t = schema.tables.find(x => x.id === selection.tableId);
    if (!t) return null;
    return <TableInspector t={t} tables={schema.tables} onPatch={onPatchTable} />;
  }
  if (selection.type === 'field') {
    const t = schema.tables.find(x => x.id === selection.tableId);
    const f = t?.fields.find(x => x.id === selection.fieldId);
    if (!t || !f) return null;
    return <FieldInspector t={t} f={f} schema={schema} onPatch={onPatchField} onDelete={onDeleteField} />;
  }
  if (selection.type === 'group') {
    const t = schema.tables.find(x => x.id === selection.tableId);
    if (!t) return null;
    const groups = groupsOfTable(t);
    const g = groups.find(x => x.name === selection.groupName);
    if (!g) return null;
    return <GroupInspector t={t} tables={schema.tables} group={g} onSetGroupDrop={onSetGroupDrop} />;
  }
  return null;
}

function GroupInspector({ t, tables, group, onSetGroupDrop }) {
  // Built from the whole schema, not just this table: hues are assigned by
  // position in the schema's domain list, so a one-table registry would give
  // a swatch that disagrees with the canvas.
  const domains = useMemo(() => domainsOf(tables), [tables]);
  const domainColor = domainMetaOf(domains, t.domain)?.color || "var(--d-unassigned)";
  const hasWarning = group.fields.some(f => f.warning);
  // Bulk disposition. The PK is never eligible, so a group that is nothing but
  // the primary key offers no action at all.
  const eligible = group.fields.filter(f => !f.pk);
  const droppedN = eligible.filter(f => f.drop).length;
  const allDropped = eligible.length > 0 && droppedN === eligible.length;
  return (
    <div>
      <div className="panel-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: domainColor }} />
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-4)' }}>{t.name}</div>
        </div>
        <h4 style={{ marginTop: 4, fontSize: 14, textTransform: 'none', letterSpacing: 0, color: 'var(--ink)' }}>
          {group.name}
        </h4>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
          {group.fields.length} field{group.fields.length === 1 ? '' : 's'} covering this area of the table.
        </div>
        {hasWarning && (
          <div style={{
            marginTop: 8, padding: '6px 8px',
            background: 'var(--warn-bg)', color: 'var(--warn)',
            fontSize: 11, borderRadius: 4,
            display: 'flex', alignItems: 'flex-start', gap: 6,
          }}>
            <Icon.Warn style={{ flexShrink: 0, marginTop: 1, width: 12, height: 12 }} />
            <span>Contains one or more fields flagged by Schema Review.</span>
          </div>
        )}
      </div>

      {onSetGroupDrop && eligible.length > 0 && (
        <div className="panel-section">
          <h4>Disposition</h4>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 6, lineHeight: 1.45 }}>
            {droppedN === 0
              ? `Mark all ${eligible.length} field(s) in this area for deletion.`
              : allDropped
                ? `All ${eligible.length} field(s) here are marked for deletion.`
                : `${droppedN} of ${eligible.length} field(s) here are marked for deletion.`}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="tool-btn"
              disabled={allDropped}
              onClick={() => onSetGroupDrop(t.id, group.name, true)}
            >
              Mark all
            </button>
            <button
              className="tool-btn"
              disabled={droppedN === 0}
              onClick={() => onSetGroupDrop(t.id, group.name, false)}
            >
              Unmark all
            </button>
          </div>
        </div>
      )}

      <div className="panel-section">
        <h4>Fields in this area</h4>
        {group.fields.map(f => (
          <div key={f.id} style={{
            display: 'grid',
            gridTemplateColumns: '8px 1fr auto',
            gap: 8,
            padding: '4px 0',
            borderBottom: '1px solid var(--line)',
            alignItems: 'center',
            opacity: f.drop ? 0.5 : 1,
            textDecoration: f.drop ? 'line-through' : 'none',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: f.pk ? 'var(--warn)' : f.fk ? 'var(--accent)' : 'transparent',
            }} />
            <div>
              <div className="mono" style={{ fontSize: 12 }}>{f.name}</div>
              {f.description && (
                <div style={{ fontSize: 10.5, color: 'var(--ink-4)', marginTop: 2, lineHeight: 1.4 }}>
                  {f.description}
                </div>
              )}
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>{f.type}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TableInspector({ t, tables, onPatch }) {
  const domains = useMemo(() => domainsOf(tables), [tables]);
  const domainOpts = useMemo(
    () => (domains[t.domain] ? Object.keys(domains) : [t.domain, ...Object.keys(domains)].filter(Boolean)),
    [domains, t.domain],
  );
  const dcOpts = useMemo(() => ["", ...dataClassOptions(tables)], [tables]);

  return (
    <div>
      <div className="panel-section">
        <h4>Table</h4>
        <div className="input-row">
          <label>Name</label>
          <input className="input" value={t.name} onChange={(e) => onPatch(t.id, { name: e.target.value })} />
        </div>
        <div className="input-row">
          <label>Domain</label>
          <select className="select" value={t.domain} onChange={(e) => onPatch(t.id, { domain: e.target.value })}>
            {domainOpts.map(d => <option key={d} value={d}>{domainMetaOf(domains, d).name}</option>)}
          </select>
        </div>
        <div className="input-row">
          <label>Data class</label>
          <select className="select" value={t.dataClass || ""} onChange={(e) => onPatch(t.id, { dataClass: e.target.value || null })}>
            {dcOpts.map(c => <option key={c} value={c}>{dataClassOf(c)?.label || "—"}</option>)}
          </select>
        </div>
        <div className="input-row" style={{ alignItems: 'flex-start' }}>
          <label>Description</label>
          <textarea className="textarea" value={t.description || ""} onChange={(e) => onPatch(t.id, { description: e.target.value })} />
        </div>
        {t.purpose && (
          <div className="input-row" style={{ alignItems: 'flex-start' }}>
            <label>Purpose</label>
            <textarea className="textarea" value={t.purpose} onChange={(e) => onPatch(t.id, { purpose: e.target.value })} />
          </div>
        )}
      </div>

      {t.conversationPoint && (
        <div className="panel-section" style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 10 }}>
          <h4 style={{ color: 'var(--accent)' }}>Open question</h4>
          <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-2)' }}>{t.conversationPoint}</div>
        </div>
      )}

      <div className="panel-section">
        <h4>Ownership</h4>
        <div className="row"><span className="k">Owning domain</span><span className="v">{domainMetaOf(domains, t.owningDomain)?.name || <em style={{color:'var(--danger)'}}>unassigned</em>}</span></div>
        <div className="row"><span className="k">Source of truth</span><span className="v">{t.sourceOfTruth || "—"}</span></div>
        <div className="row"><span className="k">Write owner</span><span className="v">{t.writeOwner || "—"}</span></div>
        <div className="row"><span className="k">Sync direction</span><span className="v">{t.syncDirection || "—"}</span></div>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <span className="k">Consumers</span>
          <span className="v" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {(t.consumingDomains || []).map(d => (
              <span key={d} className="mono" style={{
                fontSize: 10, padding: '1px 6px',
                background: 'var(--surface-sunken)', borderRadius: 3,
                color: 'var(--ink-2)',
              }}>{domainMetaOf(domains, d).name}</span>
            ))}
          </span>
        </div>
      </div>

      {(Array.isArray(t.owns) && t.owns.length > 0) || (Array.isArray(t.doesNotOwn) && t.doesNotOwn.length > 0) ? (
        <div className="panel-section">
          <h4>Ownership rules</h4>
          {Array.isArray(t.owns) && t.owns.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--good, var(--accent))', marginBottom: 4 }}>Owns</div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.5 }}>
                {t.owns.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
          )}
          {Array.isArray(t.doesNotOwn) && t.doesNotOwn.length > 0 && (
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--danger)', marginBottom: 4 }}>Does NOT own</div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.5, color: 'var(--ink-3)' }}>
                {t.doesNotOwn.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      <div className="panel-section">
        <h4>Characteristics</h4>
        <div className="row"><span className="k">Change frequency</span><span className="v mono" style={{ fontSize: 11 }}>{t.changeFrequency || "—"}</span></div>
        <div className="row"><span className="k">Sensitivity</span><span className="v mono" style={{ fontSize: 11 }}>{t.sensitivity || "—"}</span></div>
        <div className="row"><span className="k">Field count</span><span className="v mono" style={{ fontSize: 11 }}>{t.fields.length}</span></div>
        {t.fields.some(f => f.drop) && (
          <div className="row">
            <span className="k">Marked for deletion</span>
            <span className="v mono" style={{ fontSize: 11, color: 'var(--danger)' }}>
              {t.fields.filter(f => f.drop).length}
            </span>
          </div>
        )}
      </div>

      <div className="panel-section">
        <h4>Fields</h4>
        {t.fields.map(f => (
          <div key={f.id} className="row" style={{ padding: '2px 0', opacity: f.drop ? 0.5 : 1 }}>
            <span className="k mono" style={{ width: 14, color: f.pk ? 'var(--warn)' : f.fk ? 'var(--accent)' : 'var(--ink-4)' }}>
              {f.pk ? "PK" : f.fk ? "FK" : "·"}
            </span>
            <span className="v mono" style={{ fontSize: 11, flex: 1, textDecoration: f.drop ? 'line-through' : 'none' }}>{f.name}</span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>{f.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FieldInspector({ t, f, schema, onPatch, onDelete }) {
  const fkTargets = useMemo(() => {
    const out = [];
    for (const tt of schema.tables) {
      for (const ff of tt.fields) {
        if (ff.pk) out.push({ table: tt.id, field: ff.id, label: `${tt.name}.${ff.name}` });
      }
    }
    return out;
  }, [schema]);

  return (
    <div>
      <div className="panel-section">
        <h4>Field</h4>
        <div className="row"><span className="k">In table</span><span className="v mono" style={{ fontSize: 11 }}>{t.name}</span></div>
        <div className="input-row" style={{ marginTop: 6 }}>
          <label>Name</label>
          <input className="input" value={f.name} onChange={(e) => onPatch(t.id, f.id, { name: e.target.value })} />
        </div>
        <div className="input-row">
          <label>Type</label>
          <input className="input" value={f.type} onChange={(e) => onPatch(t.id, f.id, { type: e.target.value })} />
        </div>
        <div className="input-row" style={{ alignItems: 'flex-start' }}>
          <label>Description</label>
          <textarea className="textarea" value={f.description || ""} onChange={(e) => onPatch(t.id, f.id, { description: e.target.value })} />
        </div>
        <div className="input-row">
          <label>Example</label>
          <input className="input" value={f.example || ""} onChange={(e) => onPatch(t.id, f.id, { example: e.target.value })} />
        </div>
      </div>

      <div className="panel-section">
        <h4>Legacy source</h4>
        <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 6 }}>
          The legacy PRODUCT-file field(s) this maps to — blank means net-new.
        </div>
        <textarea
          className="textarea"
          placeholder="e.g. PRODUCT.DESC"
          value={f.legacyField || ""}
          onChange={(e) => onPatch(t.id, f.id, { legacyField: e.target.value })}
        />
      </div>

      <div className="panel-section">
        <h4>Constraints</h4>
        <label className="checkbox-row"><input type="checkbox" checked={f.pk} onChange={(e) => onPatch(t.id, f.id, { pk: e.target.checked })} /> Primary key</label>
        <label className="checkbox-row"><input type="checkbox" checked={!f.nullable} onChange={(e) => onPatch(t.id, f.id, { nullable: !e.target.checked })} /> Required (NOT NULL)</label>
        <label className="checkbox-row"><input type="checkbox" checked={f.unique} onChange={(e) => onPatch(t.id, f.id, { unique: e.target.checked })} /> Unique</label>
        <label className="checkbox-row"><input type="checkbox" checked={f.indexed} onChange={(e) => onPatch(t.id, f.id, { indexed: e.target.checked })} /> Indexed</label>
      </div>

      <div className="panel-section">
        <h4>Disposition</h4>
        <label className="checkbox-row" title="Record the decision to drop this field">
          <input
            type="checkbox"
            checked={!!f.drop}
            onChange={(e) => onPatch(t.id, f.id, { drop: e.target.checked })}
          /> Marked for deletion
        </label>
        <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4, lineHeight: 1.45 }}>
          Kept in the schema and in every export, but hidden on the canvas unless
          “Dropped” is toggled on.
        </div>
        {f.pk && (
          <div style={{ fontSize: 11, color: 'var(--warn)', marginTop: 6, lineHeight: 1.45 }}>
            This is the table's primary key. Marking it orphans every field whose
            FK points here (shown struck through in amber), and cascades onward.
            The key itself stays on the canvas so those relationships keep an
            anchor and you can un-mark it here.
          </div>
        )}
      </div>

      <div className="panel-section">
        <h4>Foreign key</h4>
        <select
          className="select"
          value={f.fk ? `${f.fk.table}::${f.fk.field}` : ""}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return onPatch(t.id, f.id, { fk: null });
            const [table, field] = v.split("::");
            onPatch(t.id, f.id, { fk: { table, field } });
          }}
        >
          <option value="">— none —</option>
          {fkTargets.map(opt => (
            <option key={`${opt.table}::${opt.field}`} value={`${opt.table}::${opt.field}`}>{opt.label}</option>
          ))}
        </select>
      </div>

      {(f.category || f.computed) && (
        <div className="panel-section">
          <h4>Classification</h4>
          {f.category && (
            <div style={{ fontSize: 12, marginBottom: f.computed ? 6 : 0 }}>
              Category: <b>{f.category}</b>
            </div>
          )}
          {f.computed && (
            <div style={{ fontSize: 12 }}>
              <div style={{ color: 'var(--ink-4)', marginBottom: 2 }}>Computed, not stored:</div>
              <code style={{ fontSize: 11.5 }}>{f.computed}</code>
            </div>
          )}
        </div>
      )}

      {Array.isArray(f.issues) && f.issues.length > 0 && (
        <div className="panel-section">
          <h4>Review findings</h4>
          {f.issues.map((it, i) => (
            <div className="panel-issue" key={i}>
              <div className="kind">{it.kind}</div>
              <div style={{ fontSize: 12 }}>{it.detail}</div>
            </div>
          ))}
        </div>
      )}

      {f.warning && (
        <div className="panel-section" style={{ background: 'var(--warn-bg)' }}>
          <h4 style={{ color: 'var(--warn)' }}>Warning</h4>
          <div style={{ fontSize: 12 }}>{f.warning.message}</div>
        </div>
      )}

      <div className="panel-section">
        <button
          className="tool-btn"
          style={{ border: '1px solid var(--line)', color: 'var(--danger)', width: '100%', justifyContent: 'center' }}
          onClick={() => onDelete(t.id, f.id)}
        >
          <Icon.Trash /> Delete field
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   Schema Review panel
================================================================ */
export function ReviewPanel({ findings, onJump }) {
  const [filter, setFilter] = useState("all");
  const counts = useMemo(() => {
    const c = { all: findings.length, high: 0, medium: 0, low: 0 };
    findings.forEach(f => { c[f.severity]++; });
    return c;
  }, [findings]);

  const filtered = filter === "all" ? findings : findings.filter(f => f.severity === filter);

  return (
    <>
      <div className="review-filters">
        {["all", "high", "medium", "low"].map(s => (
          <button
            key={s}
            className={`review-filter ${filter === s ? 'active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s} <span style={{ opacity: 0.7 }}>{counts[s]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="panel-empty">
          <Icon.Check style={{ display: 'block', margin: '0 auto', color: 'var(--good)' }} />
          <div>No findings.</div>
        </div>
      ) : filtered.map(f => (
        <div key={f.id} className="review-item" onClick={() => onJump(f.target)}>
          <div className={`review-icon ${f.severity}`}>
            {f.severity === 'high' ? <Icon.Warn /> : f.severity === 'medium' ? <Icon.Warn /> : <Icon.Info />}
          </div>
          <div>
            <div className="review-title">{f.title}</div>
            <div className="review-meta">{f.category} · {f.severity}</div>
            <div className="review-body">{f.body}</div>
          </div>
        </div>
      ))}
    </>
  );
}

/* ================================================================
   Minimap
================================================================ */
export function Minimap({ tables, positions, view, hostSize, onPan }) {
  const domains = useMemo(() => domainsOf(tables), [tables]);
  // Real card size, from the same DOM measurement the relationship layer uses
  // (`computeFieldPositions`). Card height depends on viewMode — core lists
  // groups, detail lists every field — so it can't be derived from field count.
  // The estimate is only a first-frame fallback, before measurement lands.
  const sizeOf = useCallback((t) => {
    const p = positions?.[t.id];
    if (p && p.w > 0 && p.h > 0) return { w: p.w, h: p.h };
    return { w: 240, h: 48 + t.fields.length * 22 };
  }, [positions]);

  // Compute world bounds
  const bounds = useMemo(() => {
    if (tables.length === 0) return { x: 0, y: 0, w: 1000, h: 1000 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const t of tables) {
      const { w, h } = sizeOf(t);
      minX = Math.min(minX, t.x);
      minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x + w);
      maxY = Math.max(maxY, t.y + h);
    }
    const pad = 100;
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  }, [tables, sizeOf]);

  const mapW = 140, mapH = 90;
  const sx = mapW / bounds.w;
  const sy = mapH / bounds.h;
  const scale = Math.min(sx, sy);
  // Uniform scale leaves slack on one axis; centre it so the drawing sits in
  // the middle of the panel instead of hugging the top-left corner.
  const offX = (mapW - bounds.w * scale) / 2;
  const offY = (mapH - bounds.h * scale) / 2;

  // Visible rect in world coordinates
  const visW = hostSize.w / view.k;
  const visH = hostSize.h / view.k;
  const visX = -view.x / view.k;
  const visY = -view.y / view.k;

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const worldX = bounds.x + (cx - offX) / scale;
    const worldY = bounds.y + (cy - offY) / scale;
    onPan(worldX - visW / 2, worldY - visH / 2);
  };

  return (
    <div className="minimap" onMouseDown={handleClick}>
      <svg width={mapW} height={mapH} viewBox={`0 0 ${mapW} ${mapH}`}>
        {tables.map(t => {
          const { w, h } = sizeOf(t);
          const color = domainMetaOf(domains, t.domain)?.color || 'var(--d-unassigned)';
          return (
            <rect
              key={t.id}
              className="minimap-table"
              x={offX + (t.x - bounds.x) * scale}
              y={offY + (t.y - bounds.y) * scale}
              width={w * scale}
              height={h * scale}
              fill={color}
              opacity="0.55"
            />
          );
        })}
        <rect
          className="minimap-rect"
          x={offX + (visX - bounds.x) * scale}
          y={offY + (visY - bounds.y) * scale}
          width={visW * scale}
          height={visH * scale}
        />
      </svg>
    </div>
  );
}

/* ================================================================
   Domain legend
================================================================ */
export function DomainLegend({ tables, hiddenDomains, onToggle }) {
  const [open, setOpen] = useState(false);
  const domains = useMemo(() => domainsOf(tables), [tables]);
  const counts = {};
  for (const t of tables) {
    if (t.domain) counts[t.domain] = (counts[t.domain] || 0) + 1;
  }
  const used = Object.keys(domains).filter(d => counts[d]);
  const hiddenN = hiddenDomains.size;
  return (
    <div className={`legend ${open ? 'open' : ''}`}>
      <div className="legend-head" onClick={() => setOpen(o => !o)}>
        <span className="lh-title">Domains</span>
        <span className="lh-count">{used.length - hiddenN}/{used.length}</span>
        <Icon.Chevron />
      </div>
      <div className="legend-body">
        {used.map(d => (
          <div
            key={d}
            className={`legend-row ${hiddenDomains.has(d) ? 'dim' : ''}`}
            onClick={() => onToggle(d)}
          >
            <span className="sw" style={{ background: domainMetaOf(domains, d).color }} />
            <span>{domainMetaOf(domains, d).name}</span>
            <span className="ct">{counts[d]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   Export modal
================================================================ */
export function ExportModal({ kind, content, rebuild, initialOptions, onClose }) {
  const ref = useRef(null);
  // Local options for format-specific toggles (e.g. Mermaid's includeComments).
  // When changed, we call rebuild() and replace the local text so the textarea,
  // copy and download all see the regenerated content.
  const [opts, setOpts] = useState(initialOptions || {});
  const [text, setText] = useState(content);
  const updateOpts = (patch) => {
    const next = { ...opts, ...patch };
    setOpts(next);
    if (typeof rebuild === 'function') setText(rebuild(next));
  };

  const copy = () => {
    if (ref.current) {
      ref.current.select();
      try { document.execCommand('copy'); } catch (e) {}
    }
  };
  const FORMATS = {
    sql:     { ext: 'sql', mime: 'application/sql',  title: 'Export SQL DDL' },
    json:    { ext: 'json', mime: 'application/json', title: 'Export schema as JSON' },
    md:      { ext: 'md', mime: 'text/markdown',     title: 'Export documentation (Markdown)' },
    mermaid: { ext: 'mmd', mime: 'text/plain',       title: 'Export Mermaid ER diagram (.mmd)' },
  };
  const fmt = FORMATS[kind] || FORMATS.md;
  const download = () => {
    const blob = new Blob([text], { type: fmt.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schema.${fmt.ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-head">
          {fmt.title}
          {kind === 'mermaid' && (
            <a
              href="https://mermaid.live/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginLeft: 12, fontSize: 11, color: 'var(--accent)', textDecoration: 'underline' }}
            >
              Open in mermaid.live ↗
            </a>
          )}
          <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose}><Icon.X /></button>
        </div>
        {kind === 'mermaid' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '8px 16px',
            borderBottom: '1px solid var(--line)',
            fontSize: 12,
            color: 'var(--ink-3)',
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={opts.includeComments !== false}
                onChange={(e) => updateOpts({ includeComments: e.target.checked })}
              />
              Include field descriptions
            </label>
            <span style={{ color: 'var(--ink-4)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10 }}>
              {text.split('\n').length} lines · {text.length} chars
            </span>
          </div>
        )}
        <div className="modal-body">
          <textarea ref={ref} className="sql" readOnly value={text} style={{ width: '100%', minHeight: 360 }} />
        </div>
        <div className="modal-foot">
          <button className="tool-btn" onClick={copy}>Copy to clipboard</button>
          <button className="tool-btn primary" onClick={download}>Download file</button>
        </div>
      </div>
    </div>
  );
}

