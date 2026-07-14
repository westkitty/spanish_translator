// Model tiers + per-device backend policy. Kept separate from the worker so the
// interface can describe choices without loading Transformers.js on the UI thread.

export type WhisperModel =
  | 'Xenova/whisper-tiny'
  | 'Xenova/whisper-base'
  | 'Xenova/whisper-small'
  | 'onnx-community/whisper-large-v3-turbo';

export interface ModelTier {
  id: WhisperModel;
  label: string;
  blurb: string;
  requiresWebGPU?: boolean;
  recommended?: boolean;
}

export const MODEL_TIERS: ModelTier[] = [
  {
    id: 'Xenova/whisper-tiny',
    label: 'Tiny',
    blurb: 'Lowest memory use and fastest processing. Best for short, clear speech.',
  },
  {
    id: 'Xenova/whisper-base',
    label: 'Base',
    blurb: 'Default balance of speed, memory use, and transcription quality.',
    recommended: true,
  },
  {
    id: 'Xenova/whisper-small',
    label: 'Small',
    blurb: 'Uses more memory and may take substantially longer on a phone or tablet.',
  },
];

export interface BackendChoice {
  device: 'wasm';
  dtype: { encoder_model: string; decoder_model_merged: string };
}

export function resolveBackend(_model: WhisperModel): BackendChoice {
  return { device: 'wasm', dtype: { encoder_model: 'fp32', decoder_model_merged: 'q8' } };
}

export function availableTiers(): ModelTier[] {
  return MODEL_TIERS.filter((tier) => !tier.requiresWebGPU);
}

export function defaultModel(): WhisperModel {
  return 'Xenova/whisper-base';
}
