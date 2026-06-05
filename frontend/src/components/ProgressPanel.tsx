import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { RunProgress, TranscriberStatus } from '../hooks/useTranscriber';

interface ProgressPanelProps {
  status: TranscriberStatus;
  modelProgress: number; // 0-100 aggregate model download
  progress: RunProgress | null;
  onCancel: () => void;
}

const HEADLINES: Partial<Record<TranscriberStatus, string>> = {
  decoding: 'Getting your audio ready…',
  'loading-model': 'Warming up the voice model…',
  transcribing: 'Writing down what’s being said…',
  translating: 'Translating it to English…',
};

function friendlyRemaining(ms: number | null): string {
  if (ms === null) return 'Estimating time…';
  if (ms <= 1500) return 'Almost done!';
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `About ${sec} sec left`;
  if (sec === 0) return `About ${min} min left`;
  return `About ${min} min ${sec} sec left`;
}

function friendlyElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}m ${sec}s elapsed` : `${sec}s elapsed`;
}

export function ProgressPanel({ status, modelProgress, progress, onCancel }: ProgressPanelProps) {
  // Smoothly tick the displayed countdown between the coarse per-window updates.
  const anchorRef = useRef<{ endAt: number | null; elapsedBase: number; at: number }>({
    endAt: null,
    elapsedBase: 0,
    at: Date.now(),
  });
  const [, force] = useState(0);

  useEffect(() => {
    anchorRef.current = {
      endAt: progress?.etaMs != null ? Date.now() + progress.etaMs : null,
      elapsedBase: progress?.elapsedMs ?? 0,
      at: Date.now(),
    };
  }, [progress?.etaMs, progress?.elapsedMs]);

  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const now = Date.now();
  const liveEta =
    anchorRef.current.endAt != null ? Math.max(0, anchorRef.current.endAt - now) : progress?.etaMs ?? null;
  const liveElapsed = anchorRef.current.elapsedBase + (now - anchorRef.current.at);

  const isDownloading = status === 'loading-model' && modelProgress > 0;
  const determinate = isDownloading ? modelProgress / 100 : progress?.fraction ?? null;
  const headline = HEADLINES[status] ?? 'Working on it…';

  return (
    <div className="glass rounded-2xl p-6 flex flex-col items-center text-center space-y-4">
      <Loader2 className="w-9 h-9 text-sky-300 animate-spin" />

      <div>
        <h3 className="text-base font-bold text-slate-100">{headline}</h3>
        <p className="text-[11px] text-slate-400 mt-1" aria-live="polite">
          {isDownloading
            ? `Downloading the model — ${modelProgress}% (one time only)`
            : status === 'decoding'
            ? 'Reading your file…'
            : friendlyRemaining(liveEta)}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-md bg-white/[0.04] rounded-full h-2.5 overflow-hidden border border-white/10">
        {determinate != null ? (
          <div
            className="bg-gradient-to-r from-sky-400 to-blue-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.round(determinate * 100)}%` }}
          />
        ) : (
          <div className="h-full w-1/3 bg-gradient-to-r from-sky-400/60 to-blue-500/60 rounded-full animate-pulse" />
        )}
      </div>

      <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
        {determinate != null && <span>{Math.round(determinate * 100)}%</span>}
        {progress && <span>{friendlyElapsed(liveElapsed)}</span>}
      </div>

      <p className="text-[10px] text-slate-400">
        Everything runs on your device — your audio never leaves it.
      </p>

      <button
        onClick={onCancel}
        className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
      >
        <X className="w-3.5 h-3.5" /> Cancel
      </button>
    </div>
  );
}
