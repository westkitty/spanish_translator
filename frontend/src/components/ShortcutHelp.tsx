import { useEffect, useRef, useState } from 'react';
import { Keyboard, X } from 'lucide-react';

const SHORTCUTS = [
  { keys: 'Space', action: 'Play or pause after a transcript is ready.' },
  { keys: '← / →', action: 'Seek backward or forward 5 seconds.' },
  { keys: 'Esc', action: 'Close this help panel or the theme picker.' },
  { keys: 'Tab', action: 'Move through controls using native focus order.' },
];

export function ShortcutHelp() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <div className="shortcut-help">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="shortcut-help__trigger"
        aria-label="Open keyboard shortcuts"
      >
        <Keyboard className="w-5 h-5" />
      </button>

      {open && (
        <div className="shortcut-help__backdrop animate-fade-in" onClick={() => setOpen(false)}>
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcut-help-title"
            tabIndex={-1}
            className="shortcut-help__panel glass-strong animate-scale-in"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="shortcut-help__header">
              <div>
                <h2 id="shortcut-help-title" className="shortcut-help__title">Keyboard shortcuts</h2>
                <p className="shortcut-help__subtitle">Current shortcuts stay simple. More can land after the transport refactor.</p>
              </div>
              <button type="button" className="shortcut-help__close" onClick={() => setOpen(false)} aria-label="Close keyboard shortcuts">
                <X className="w-4 h-4" />
              </button>
            </div>

            <dl className="shortcut-help__list">
              {SHORTCUTS.map((shortcut) => (
                <div key={shortcut.keys} className="shortcut-help__row">
                  <dt><kbd>{shortcut.keys}</kbd></dt>
                  <dd>{shortcut.action}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
