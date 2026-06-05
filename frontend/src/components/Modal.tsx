import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Hide the close button + disable backdrop/ESC close (for required gates). */
  dismissible?: boolean;
  labelledBy?: string;
  children: ReactNode;
}

// Accessible glassmorphic modal: role=dialog, aria-modal, ESC + backdrop close,
// initial focus, scroll-locked body. Used for both the welcome gate and FAQ.
export function Modal({
  open,
  onClose,
  title,
  dismissible = true,
  labelledBy,
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) onClose();
    };
    document.addEventListener('keydown', onKey);

    // Lock background scroll while open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog.
    const t = window.setTimeout(() => panelRef.current?.focus(), 0);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
    };
  }, [open, dismissible, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(3, 7, 18, 0.72)' }}
      onClick={() => dismissible && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong relative w-full max-w-md max-h-[88vh] overflow-y-auto rounded-2xl p-5 outline-none animate-scale-in"
      >
        {(title || dismissible) && (
          <div className="flex items-start justify-between gap-3 mb-3">
            {title && (
              <h2 id={labelledBy} className="text-base font-bold text-slate-100 tracking-tight">
                {title}
              </h2>
            )}
            {dismissible && (
              <button
                onClick={onClose}
                aria-label="Close dialog"
                className="ml-auto -mr-1 -mt-1 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
