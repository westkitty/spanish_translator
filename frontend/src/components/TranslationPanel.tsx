import { Languages } from 'lucide-react';
import type { Translation } from '../hooks/useTranscriber';

interface TranslationPanelProps {
  translation: Translation | null;
  currentTime: number;
  onSeek: (time: number) => void;
}

// Read-only English translation, shown alongside the editable Spanish transcript.
// Segments are sentence-level (Whisper translate task) and clickable to seek.
export function TranslationPanel({ translation, currentTime, onSeek }: TranslationPanelProps) {
  if (!translation || translation.segments.length === 0) {
    return null;
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-3">
        <Languages className="w-4 h-4 text-emerald-400" />
        <h2 className="text-sm font-semibold tracking-wide text-slate-200">
          ENGLISH TRANSLATION
        </h2>
        <span className="ml-auto text-[10px] text-emerald-400/80 font-mono">
          {translation.segments.length} segment{translation.segments.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="space-y-1.5 leading-relaxed">
        {translation.segments.map((seg) => {
          const isActive = currentTime >= seg.start && currentTime <= seg.end;
          return (
            <p
              key={seg.id}
              onClick={() => onSeek(seg.start)}
              className={`cursor-pointer px-2 py-1 rounded text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-emerald-600/20 text-emerald-100 border border-emerald-500/40'
                  : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
              }`}
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
