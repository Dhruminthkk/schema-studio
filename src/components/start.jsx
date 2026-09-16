// The start screen — what the app opens on before any schema is loaded.
//
// Full-bleed and centred, not a dialog. Two earlier attempts are worth naming
// so they don't get rebuilt: a single stacked column ran to ~1200px and
// scrolled on every normal display, and the two-pane version that replaced it
// fit fine but read as a settings dialog with a grey sidebar.
//
// So: one centred column, the import path stated once and prominently, and the
// bundled models as a card grid rather than a list. Compact cards — name,
// counts, a tint drawn from the schema's own leading domain — keep all eight
// visible in a single viewport without the page feeling dense.

import React, { useEffect, useMemo } from 'react';
import { Icon } from './canvas.jsx';
import { BUILTIN_SCHEMAS, SCHEMA_GROUPS, schemasInGroup, schemaStats } from '../data/schemas.js';
import { spreadHues, colorFromHue } from '../lib/palette.js';

// A stable identity colour per schema, so the cards are told apart at a glance
// rather than reading as one blue grid.
//
// Two earlier attempts are worth recording. Using the schema's leading domain
// gave every card the same colour, because domainsOf hands out hues by position
// in the sorted domain list and so every schema's first domain lands on the
// origin hue. Hashing the id instead collided — ardent_minimal and
// ardent_policyholder_normalised both landed on hue 74. Assigning by position
// in the registry, golden-angle spaced, is the same fix the domain palette
// uses and is collision-free by construction.
const SCHEMA_HUES = spreadHues(BUILTIN_SCHEMAS.length);
const hueOfSchema = (id) => {
  const i = BUILTIN_SCHEMAS.findIndex(s => s.id === id);
  return SCHEMA_HUES[i < 0 ? 0 : i];
};

function SchemaCard({ entry, active, onPick }) {
  const stats = schemaStats(entry);
  const accent = useMemo(() => colorFromHue(hueOfSchema(entry.id)), [entry.id]);
  // A glyph standing in for the model's shape: one bar per table, capped so a
  // 14-table schema still reads as a card rather than a barcode.
  const bars = Math.min(stats.tables, 6);
  return (
    <button
      type="button"
      className={`sc-card ${active ? 'active' : ''}`}
      style={{ '--sc-accent': accent }}
      title={entry.description}
      onClick={() => onPick(entry.id)}
    >
      <span className="sc-glyph" aria-hidden="true">
        {Array.from({ length: bars }, (_, i) => (
          <span key={i} style={{ opacity: 1 - i * 0.13 }} />
        ))}
      </span>
      <span className="sc-name">{entry.name}</span>
      <span className="sc-stats">
        {stats.tables} tables · {stats.fields} fields
      </span>
      {active && <Icon.Check className="sc-tick" />}
    </button>
  );
}

export function StartScreen({ activeSchemaId, canClose, onPick, onImportJson, onImportSql, onClose }) {
  // Escape closes, but only once there is something to go back to.
  useEffect(() => {
    if (!canClose) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canClose, onClose]);

  return (
    <div className="sc-root" role="dialog" aria-modal="true" aria-label="Choose a schema">
      {canClose && (
        <button type="button" className="sc-close" onClick={onClose} title="Close (Esc)">
          <Icon.X />
        </button>
      )}

      <div className="sc-inner">
        <div className="sc-brandline">
          <div className="brand-mark" />
          <span>Schema Studio</span>
        </div>

        <h1 className="sc-title">
          The model, as something you can <em>walk around</em>.
        </h1>
        <p className="sc-sub">
          Pan the ERD, follow a walkthrough, and click any field to see where it came from, how
          much of the population fills it, and whether it should be stored at all.
        </p>

        <div className="sc-cta">
          <button type="button" className="sc-btn primary" onClick={onImportJson}>
            <Icon.Import /> Import JSON
          </button>
          <button type="button" className="sc-btn" onClick={onImportSql}>
            <Icon.Import /> Import SQL DDL
          </button>
          <span className="sc-note">Read in the browser · never uploaded</span>
        </div>

        {SCHEMA_GROUPS.map(group => (
          <section key={group.id} className="sc-group">
            <h2 title={group.sub}>{group.label}</h2>
            <div className="sc-grid">
              {schemasInGroup(group.id).map(entry => (
                <SchemaCard
                  key={entry.id}
                  entry={entry}
                  active={entry.id === activeSchemaId}
                  onPick={onPick}
                />
              ))}
            </div>
          </section>
        ))}

        <footer className="sc-foot">
          <span>Click <b>Schema Studio</b> top-left to come back here.</span>
          <span className="sc-links">
            <a href="site/index.html">Overview</a>
            <a href="site/guide.html">Guide</a>
          </span>
        </footer>
      </div>
    </div>
  );
}
