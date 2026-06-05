import { useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';

interface AdvancedOptionsProps {
  vocab: string;
  onVocabChange: (v: string) => void;
  highAccuracy: boolean;
  onHighAccuracyChange: (v: boolean) => void;
}

// Optional, collapsed-by-default controls so the default experience stays simple.
export function AdvancedOptions({
  vocab,
  onVocabChange,
  highAccuracy,
  onHighAccuracyChange,
}: AdvancedOptionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer hover:bg-white/[0.03] transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5 text-sky-300" />
        <span className="text-[11px] font-semibold text-slate-200">Fine-tune the result (optional)</span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 ml-auto transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 animate-fade-in">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              Corrections &amp; names
            </span>
            <textarea
              value={vocab}
              onChange={(e) => onVocabChange(e.target.value)}
              rows={3}
              placeholder={'watsap -> WhatsApp\nJosé\nNueva York'}
              className="mt-1 w-full bg-white/[0.04] text-slate-100 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:border-sky-400 focus:outline-none resize-none placeholder:text-slate-600"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              One per line. Write <span className="text-slate-300">wrong -&gt; right</span> to fix a
              word, or just type a name to lock its spelling. Applied after transcribing.
            </span>
          </label>

          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span>
              <span className="text-[12px] font-medium text-slate-200 block">Try harder for accuracy</span>
              <span className="text-[10px] text-slate-500">Slower, but can catch more.</span>
            </span>
            <input
              type="checkbox"
              checked={highAccuracy}
              onChange={(e) => onHighAccuracyChange(e.target.checked)}
              className="w-4 h-4 accent-sky-500 cursor-pointer"
            />
          </label>
        </div>
      )}
    </div>
  );
}
