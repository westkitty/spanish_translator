import { Loader2, X } from 'lucide-react';
import type { RunProgress, TranscriberStatus } from '../hooks/useTranscriber';

interface ProgressPanelProps { status: TranscriberStatus; modelProgress: number; progress: RunProgress | null; onCancel: () => void; }
const PHASES: Array<{ key: TranscriberStatus; label: string }> = [
  { key: 'decoding', label: 'Prepare audio' },
  { key: 'loading-model', label: 'Load model files' },
  { key: 'transcribing', label: 'Create Spanish transcript' },
  { key: 'translating', label: 'Create English translation' },
];

export function ProgressPanel({ status, modelProgress, progress, onCancel }: ProgressPanelProps) {
  const currentIndex = PHASES.findIndex((phase) => phase.key === status);
  const downloading = status === 'loading-model' && modelProgress > 0;
  const determinate = downloading ? modelProgress / 100 : status === 'transcribing' ? progress?.fraction ?? null : null;
  const detail = downloading
    ? `Downloading uncached model files: ${modelProgress}%`
    : status === 'loading-model'
    ? 'Checking and loading the model files required for this run.'
    : status === 'translating'
    ? 'Translation time varies with transcript length and device speed.'
    : status === 'decoding'
    ? 'Reading and preparing the selected audio file.'
    : 'Keep this screen open while the transcript is created.';

  return (
    <section className="progress-card" aria-labelledby="progress-heading" aria-busy="true">
      <Loader2 className="animate-spin" aria-hidden="true" />
      <div><p className="eyebrow">Processing on this device</p><h2 id="progress-heading">{PHASES[currentIndex]?.label ?? 'Working on your audio'}</h2><p aria-live="polite">{detail}</p></div>
      <ol className="phase-list">{PHASES.map((phase, index) => <li key={phase.key} data-state={index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'pending'}><span>{index + 1}</span>{phase.label}</li>)}</ol>
      <div className="progress-track" role="progressbar" aria-label="Processing progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={determinate == null ? undefined : Math.round(determinate * 100)} aria-valuetext={determinate == null ? `${PHASES[currentIndex]?.label ?? 'Processing'} in progress` : `${Math.round(determinate * 100)} percent`}>
        {determinate == null ? <span className="progress-track__indeterminate" /> : <span style={{ width: `${Math.round(determinate * 100)}%` }} />}
      </div>
      <button type="button" onClick={onCancel} className="secondary-button"><X aria-hidden="true" /> Cancel processing</button>
    </section>
  );
}
