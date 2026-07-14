import { useState } from 'react';
import { ChevronDown, Settings2 } from 'lucide-react';
import type { ModelTier, WhisperModel } from '../lib/models';

interface AdvancedOptionsProps {
  model: WhisperModel;
  tiers: ModelTier[];
  onModelChange: (model: WhisperModel) => void;
  vocab: string;
  onVocabChange: (value: string) => void;
  highAccuracy: boolean;
  onHighAccuracyChange: (value: boolean) => void;
  retainAudio: boolean;
  onRetainAudioChange: (value: boolean) => void;
}

export function AdvancedOptions({
  model,
  tiers,
  onModelChange,
  vocab,
  onVocabChange,
  highAccuracy,
  onHighAccuracyChange,
  retainAudio,
  onRetainAudioChange,
}: AdvancedOptionsProps) {
  const [open, setOpen] = useState(false);
  const selectedTier = tiers.find((tier) => tier.id === model);

  return (
    <div className="run-settings">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="run-settings__trigger"
      >
        <Settings2 aria-hidden="true" />
        <span>Advanced settings</span>
        <span className="run-settings__summary">{selectedTier?.label ?? 'Base'} model</span>
        <ChevronDown aria-hidden="true" className={open ? 'rotate-180' : ''} />
      </button>

      {open && (
        <div className="run-settings__body">
          <label className="field-stack">
            <span className="field-label">Transcription model</span>
            <select value={model} onChange={(event) => onModelChange(event.target.value as WhisperModel)}>
              {tiers.map((tier) => (
                <option key={tier.id} value={tier.id}>{tier.label}</option>
              ))}
            </select>
            <span className="field-help">{selectedTier?.blurb}</span>
          </label>

          <label className="field-stack">
            <span className="field-label">Names and corrections for this run</span>
            <textarea
              value={vocab}
              onChange={(event) => onVocabChange(event.target.value)}
              rows={3}
              placeholder={'watsap -> WhatsApp\nJosé\nNueva York'}
            />
            <span className="field-help">One entry per line. These rules apply to the Spanish transcript for this session.</span>
          </label>

          <label className="setting-row">
            <span>
              <strong>Higher-quality pass</strong>
              <small>May use more memory and take substantially longer.</small>
            </span>
            <input
              type="checkbox"
              checked={highAccuracy}
              onChange={(event) => onHighAccuracyChange(event.target.checked)}
            />
          </label>

          <label className="setting-row">
            <span>
              <strong>Keep source audio in the library</strong>
              <small>Turn this off to save only the transcript and translation.</small>
            </span>
            <input
              type="checkbox"
              checked={retainAudio}
              onChange={(event) => onRetainAudioChange(event.target.checked)}
            />
          </label>
        </div>
      )}
    </div>
  );
}
