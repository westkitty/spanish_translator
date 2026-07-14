import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { applyStoredTheme, setTheme, themes, type ThemeId } from '../lib/themes';

interface ThemePickerProps {
  className?: string;
}

export function ThemePicker({ className = '' }: ThemePickerProps) {
  const [theme, setThemeState] = useState<ThemeId>(() => applyStoredTheme());
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const activeTheme = useMemo(
    () => themes.find((option) => option.id === theme) ?? themes[0],
    [theme]
  );

  useEffect(() => {
    applyStoredTheme();
  }, []);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const chooseTheme = (nextTheme: ThemeId) => {
    setTheme(nextTheme);
    setThemeState(nextTheme);
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  };

  return (
    <div ref={rootRef} className={`theme-picker relative z-40 ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Theme picker. Current theme: ${activeTheme.name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="theme-picker-panel"
        className="theme-picker__trigger min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors cursor-pointer"
      >
        <Palette className="w-5 h-5" />
      </button>

      {open && (
        <div
          id="theme-picker-panel"
          role="dialog"
          aria-label="Choose display theme"
          className="theme-picker__panel glass-strong animate-scale-in"
        >
          <div className="theme-picker__header">
            <p className="theme-picker__eyebrow">Display theme</p>
            <p className="theme-picker__help">Choose a readable local workspace. Your choice stays on this device.</p>
          </div>

          <div className="theme-picker__options" role="group" aria-label="Display themes">
            {themes.map((option) => {
              const selected = option.id === theme;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => chooseTheme(option.id)}
                  className="theme-picker__option"
                >
                  <span className="theme-picker__swatches" aria-hidden="true">
                    {option.swatches.map((swatch) => (
                      <span
                        key={swatch}
                        className="theme-picker__swatch"
                        style={{ background: swatch }}
                      />
                    ))}
                  </span>
                  <span className="theme-picker__copy">
                    <span className="theme-picker__name">{option.name}</span>
                    <span className="theme-picker__description">{option.description}</span>
                  </span>
                  {selected && <Check className="theme-picker__check" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
