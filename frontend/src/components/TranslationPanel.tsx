import { useEffect, useRef } from 'react';
import { Languages } from 'lucide-react';
import type { Translation } from '../hooks/useTranscriber';

interface TranslationPanelProps {
  translation: Translation | null;
  currentTime: number;
  onSeek: (time: number) => void;
}

// Read-only English translation shown alongside the editable Spanish transcript.
// Segments are sentence-level and clickable to seek. The active segment scrolls
// into view automatically as the playhead moves, enabling hands-free read-along.
export function TranslationPanel({ translation, currentTime, onSeek }: TranslationPanelProps) {
  const activeRef = useRef<HTMLParagraphElement | null>(null);

  // Scroll the active segment into view whenever the playhead crosses a boundary.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentTime]);

  if (!translation || translation.segments.length === 0) {
    return null;
  }

  return (
    <div className="glass rounded-2xl p-4 flex flex-col min-h-0">
      <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-3 shrink-0">
        <Languages className="w-4 h-4 shrink-0" style={{ color: 'var(--trans)' }} />
        <h2 className="text-sm font-semibold tracking-wide" style={{ color: 'var(--text)' }}>
          ENGLISH TRANSLATION
        </h2>
        <span className="ml-auto text-[11px] font-mono" style={{ color: 'var(--trans)' }}>
          {translation.segments.length} segment{translation.segments.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="overflow-y-auto space-y-1.5 leading-relaxed">
        {translation.segments.map((seg) => {
          const isActive = currentTime >= seg.start && currentTime <= seg.end;
          return (
            <p
              key={seg.id}
              ref={isActive ? activeRef : undefined}
              onClick={() => onSeek(seg.start)}
              className="cursor-pointer px-2.5 py-2 rounded-lg text-sm transition-all duration-200"
              style={
                isActive
                  ? {
                      background: 'var(--trans-bg)',
                      color: '#a7f3d0',
                      border: '1px solid var(--trans-border)',
                    }
                  : {
                      color: 'var(--text-muted)',
                      border: '1px solid transparent',
                    }
              }
              title={`[${seg.start.toFixed(1)}s – ${seg.end.toFixed(1)}s] Click to seek`}
            >
              {seg.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}
