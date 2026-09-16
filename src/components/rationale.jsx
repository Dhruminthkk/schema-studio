import React, { useEffect } from 'react';
import { Icon } from './canvas.jsx';

// Right-side panel that explains the rationale behind the active schema view.
// Takes ~60% of viewport width. Renders content from RATIONALES (data-typed,
// not free markdown) so the formatting stays consistent.

const toneColor = {
  accent: 'var(--accent)',
  warn:   'var(--warn)',
  good:   'var(--good, var(--accent))',
};
const toneBg = {
  accent: 'var(--surface-sunken)',
  warn:   'var(--warn-bg, var(--surface-sunken))',
  good:   'var(--surface-sunken)',
};

// Render a single table cell. Cells can be either a string (plain text) or
// an object { link, text }. The link form is rendered as a button that calls
// onSelectTable(link) — used by the Entity Catalog page to navigate from a
// rationale row into the ERD.
function Cell({ cell, onSelectTable }) {
  if (cell && typeof cell === 'object' && cell.link && onSelectTable) {
    return (
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSelectTable(cell.link); }}
        title={`Open ${cell.text || cell.link} in the ERD`}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          font: 'inherit',
          color: 'var(--accent)',
          cursor: 'pointer',
          textAlign: 'left',
          textDecoration: 'underline',
          textUnderlineOffset: 2,
        }}
      >
        {cell.text || cell.link}
      </button>
    );
  }
  return <>{cell}</>;
}

function Section({ s, onSelectTable }) {
  switch (s.kind) {
    case 'h2':
      return (
        <h2 style={{
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--ink)',
          marginTop: 28,
          marginBottom: 8,
          paddingBottom: 6,
          borderBottom: '1px solid var(--line)',
          letterSpacing: 0.2,
        }}>{s.text}</h2>
      );

    case 'h3':
      return (
        <h3 style={{
          fontSize: 13.5,
          fontWeight: 600,
          color: 'var(--ink)',
          marginTop: 18,
          marginBottom: 4,
          letterSpacing: 0.1,
        }}>{s.text}</h3>
      );

    case 'p':
      return (
        <p style={{
          margin: '8px 0',
          fontSize: 13.5,
          lineHeight: 1.6,
          color: 'var(--ink-2)',
        }}>{s.text}</p>
      );

    case 'lead':
      return (
        <p style={{
          margin: '10px 0',
          fontSize: 14.5,
          lineHeight: 1.55,
          color: 'var(--ink)',
          fontWeight: 500,
        }}>{s.text}</p>
      );

    case 'bullets':
      return (
        <div style={{ margin: '10px 0' }}>
          {s.label && (
            <div style={{
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: 'var(--ink-4)',
              marginBottom: 6,
              fontWeight: 600,
            }}>{s.label}</div>
          )}
          <ul style={{
            margin: 0,
            paddingLeft: 22,
            fontSize: 13.5,
            lineHeight: 1.65,
            color: 'var(--ink-2)',
          }}>
            {s.items.map((it, i) => <li key={i} style={{ marginBottom: 4 }}>{it}</li>)}
          </ul>
        </div>
      );

    case 'table':
      return (
        <div style={{ margin: '12px 0', overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12.5,
            tableLayout: 'auto',
          }}>
            <thead>
              <tr>
                {s.head.map((h, i) => (
                  <th key={i} style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderBottom: '2px solid var(--line)',
                    color: 'var(--ink-4)',
                    fontSize: 10.5,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    background: 'var(--surface-sunken)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{
                      padding: '8px 10px',
                      borderBottom: '1px solid var(--line)',
                      color: 'var(--ink-2)',
                      lineHeight: 1.5,
                      verticalAlign: 'top',
                    }}><Cell cell={cell} onSelectTable={onSelectTable} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'callout': {
      const tone = s.tone || 'accent';
      return (
        <div style={{
          margin: '12px 0',
          padding: '12px 14px',
          background: toneBg[tone],
          borderLeft: `3px solid ${toneColor[tone]}`,
          borderRadius: 4,
        }}>
          {s.title && (
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: toneColor[tone],
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 6,
            }}>{s.title}</div>
          )}
          <div style={{
            fontSize: 13,
            lineHeight: 1.55,
            color: 'var(--ink-2)',
          }}>{s.text}</div>
        </div>
      );
    }

    case 'group-grid': {
      const groups = s.groups || [];
      return (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 12,
          margin: '14px 0',
        }}>
          {groups.map((g, gi) => (
            <div key={gi} style={{
              background: 'var(--surface-sunken)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: '12px 14px',
            }}>
              <div style={{
                fontSize: 10.5,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                color: 'var(--ink-4)',
                marginBottom: 8,
                fontWeight: 700,
              }}>{g.label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(g.entities || []).map((e, ei) => {
                  const text = typeof e === 'string' ? e : (e?.text || e?.link || '');
                  const link = (e && typeof e === 'object') ? e.link : null;
                  const isClickable = !!(link && onSelectTable);
                  return isClickable ? (
                    <button
                      key={ei}
                      type="button"
                      onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); onSelectTable(link); }}
                      title={`Open ${text} on the ERD`}
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--line)',
                        borderRadius: 4,
                        padding: '3px 9px',
                        fontSize: 12,
                        fontFamily: 'IBM Plex Mono, monospace',
                        color: 'var(--accent)',
                        cursor: 'pointer',
                      }}
                    >{text}</button>
                  ) : (
                    <span key={ei} style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: 4,
                      padding: '3px 9px',
                      fontSize: 12,
                      fontFamily: 'IBM Plex Mono, monospace',
                      color: 'var(--ink-3)',
                    }}>{text}</span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      );
    }

    case 'spacer':
      return <div style={{ height: 16 }} />;

    default:
      return null;
  }
}

export function RationalePanel({ rationale, onClose, onSelectTable }) {
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!rationale) {
    return (
      <Shell onClose={onClose}>
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-4)' }}>
          No rationale available for this schema.
        </div>
      </Shell>
    );
  }

  return (
    <Shell onClose={onClose}>
      <div style={{ padding: '28px 36px 56px 36px' }}>
        <div style={{
          paddingBottom: 18,
          borderBottom: '1px solid var(--line)',
          marginBottom: 4,
        }}>
          <div style={{
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            color: 'var(--accent)',
            fontWeight: 700,
            marginBottom: 6,
          }}>Rationale</div>
          <h1 style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--ink)',
            lineHeight: 1.3,
          }}>{rationale.title}</h1>
          {rationale.subtitle && (
            <div style={{
              fontSize: 12,
              fontFamily: 'IBM Plex Mono, monospace',
              color: 'var(--ink-4)',
              marginTop: 6,
            }}>{rationale.subtitle}</div>
          )}
          {rationale.intent && (
            <p style={{
              margin: '14px 0 0 0',
              fontSize: 13.5,
              lineHeight: 1.6,
              color: 'var(--ink-3)',
              fontStyle: 'italic',
            }}>{rationale.intent}</p>
          )}
        </div>

        {rationale.sections.map((s, i) => <Section key={i} s={s} onSelectTable={onSelectTable} />)}
      </div>
    </Shell>
  );
}

function Shell({ children, onClose }) {
  return (
    <div style={{
      position: 'fixed',
      top: 44,                 // matches .topbar in styles.css
      right: 0,
      bottom: 28,              // matches .statusbar in styles.css
      width: '60vw',
      background: 'var(--surface)',
      borderLeft: '1px solid var(--line)',
      boxShadow: 'var(--shadow-pop)',
      zIndex: 1090,
      overflowY: 'auto',
    }}>
      <button
        onClick={onClose}
        title="Close rationale (Esc)"
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          width: 32, height: 32,
          border: '1px solid var(--line)',
          background: 'var(--surface)',
          borderRadius: 6,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ink-3)',
          zIndex: 1,
        }}
      >
        <Icon.X />
      </button>
      {children}
    </div>
  );
}
