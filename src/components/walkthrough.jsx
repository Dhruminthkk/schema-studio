import React, { useEffect } from 'react';
import { Icon } from './canvas.jsx';

// Floating overlay that drives Walkthrough mode. The parent (App) owns the
// step index, the active flag, and applies the dim/highlight/pan-zoom to the
// canvas based on the current step's `focus`. This component is just the UI.
export function WalkthroughOverlay({ name, steps, stepIndex, onPrev, onNext, onJump, onExit }) {
  const step = steps[stepIndex];
  const total = steps.length;

  // Keyboard navigation: ← / → / Esc
  useEffect(() => {
    const onKey = (e) => {
      // Ignore when typing in form fields
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        onNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        onPrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNext, onPrev, onExit]);

  if (!step) return null;

  return (
    <>
      {/* Progress strip across the top */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        height: 4,
        background: 'var(--surface-sunken)',
        zIndex: 1100,
      }}>
        <div style={{
          height: '100%',
          width: `${((stepIndex + 1) / total) * 100}%`,
          background: 'var(--accent)',
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Step indicator + dots — top-center */}
      <div style={{
        position: 'fixed',
        top: 16, left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1101,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 999,
        padding: '6px 14px',
        boxShadow: 'var(--shadow-pop)',
        fontSize: 11,
        fontFamily: 'IBM Plex Mono, monospace',
        color: 'var(--ink-3)',
      }}>
        {name && <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{name}</span>}
        {name && <span style={{ color: 'var(--ink-4)' }}>·</span>}
        <span>Step {stepIndex + 1} / {total}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {steps.map((s, i) => (
            <button
              key={s.id}
              onClick={() => onJump(i)}
              title={`${i + 1}. ${s.title}`}
              style={{
                width: 8, height: 8, borderRadius: '50%',
                border: 'none', cursor: 'pointer', padding: 0,
                background: i === stepIndex
                  ? 'var(--accent)'
                  : i < stepIndex ? 'var(--ink-4)' : 'var(--surface-sunken)',
                outline: 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* Narration card — bottom-center */}
      <div style={{
        position: 'fixed',
        bottom: 56, left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1101,
        width: 'min(740px, calc(100vw - 48px))',
        maxHeight: '72vh',
        overflowY: 'auto',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        boxShadow: 'var(--shadow-pop)',
        padding: '18px 22px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          marginBottom: 10,
        }}>
          <h2 style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--ink)',
            lineHeight: 1.3,
          }}>{step.title}</h2>
          <span style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 10,
            color: 'var(--ink-4)',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            {step.focus === 'all'
              ? `overview · ${total - stepIndex - 1} steps remaining`
              : `${Array.isArray(step.focus) ? step.focus.length : 0} table${(Array.isArray(step.focus) && step.focus.length === 1) ? '' : 's'} focused`}
          </span>
        </div>
        {Array.isArray(step.touches) && step.touches.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {step.touches.map((m) => (
              <span key={m} style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 10,
                background: 'var(--surface-sunken)',
                color: 'var(--ink-3)',
                padding: '2px 7px',
                borderRadius: 3,
                letterSpacing: 0.3,
              }}>{m}</span>
            ))}
          </div>
        )}

        <p style={{
          margin: 0,
          fontSize: 13.5,
          lineHeight: 1.55,
          color: 'var(--ink-2)',
        }}>{step.body}</p>

        {Array.isArray(step.questions) && step.questions.length > 0 && (
          <div style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--line)',
          }}>
            <div style={{
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: 'var(--accent)',
              marginBottom: 6,
              fontWeight: 600,
            }}>Open questions</div>
            <ul style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 12.5,
              lineHeight: 1.55,
              color: 'var(--ink-2)',
            }}>
              {step.questions.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          </div>
        )}

        <div style={{
          marginTop: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <button
            className="tool-btn"
            onClick={onPrev}
            disabled={stepIndex === 0}
            style={{ opacity: stepIndex === 0 ? 0.4 : 1 }}
          >
            <Icon.ChevronRight style={{ transform: 'rotate(180deg)' }} /> Prev
          </button>
          <button
            className="tool-btn primary"
            onClick={onNext}
            disabled={stepIndex === total - 1}
            style={{ opacity: stepIndex === total - 1 ? 0.4 : 1 }}
          >
            Next <Icon.ChevronRight />
          </button>
          <span style={{ flex: 1 }} />
          <span style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 10,
            color: 'var(--ink-4)',
            marginRight: 8,
          }}>
            ← → arrows
          </span>
          <button className="tool-btn" onClick={onExit}>
            <Icon.X /> Exit
          </button>
        </div>
      </div>
    </>
  );
}
