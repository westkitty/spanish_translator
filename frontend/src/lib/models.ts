// Model tiers + per-device backend policy. Lives in its own module (not the
// worker) so the UI can import the tier list and capability checks without
// pulling @huggingface/transformers into the main bundle.

export type WhisperModel =
  | 'Xenova/whisper-tiny'
  | 'Xenova/whisper-base'
  | 'Xenova/whisper-small'
  | 'onnx-community/whisper-large-v3-turbo';

export interface ModelTier {
  id: WhisperModel;
  /** Short, friendly name shown in the picker. */
  label: string;
  /** One-line description (speed/accuracy/size). */
  blurb: string;
  /** Best/largest tier only runs at a usable speed on the WebGPU backend. */
  requiresWebGPU?: boolean;
  /** Highlighted as the quality recommendation. */
  recommended?: boolean;
}

// Ordered fast → best. (The WebGPU-only large-v3-turbo tier is intentionally not
// offered: inference runs on WASM only — see resolveBackend — so a tier that is
// only practical on WebGPU would be unusably slow.)
export const MODEL_TIERS: ModelTier[] = [
  {
    id: 'Xenova/whisper-tiny',
    label: 'Fast',
    blurb: 'Tiny — quickest, roughest. Good for a quick draft (~45 MB).',
  },
  {
    id: 'Xenova/whisper-base',
    label: 'Balanced',
    blurb: 'Base — the default all-rounder (~85 MB).',
  },
  {
    id: 'Xenova/whisper-small',
    label: 'Accurate',
    blurb: 'Small — noticeably better Spanish; slower (~250 MB).',
    recommended: true,
  },
];

export interface BackendChoice {
  device: 'wasm';
  // `dtype` is passed straight to the Transformers.js pipeline (per-module map).
  dtype: { encoder_model: string; decoder_model_merged: string };
}

/**
 * Device + quantization policy. **WASM/CPU only** — WebGPU is intentionally not
 * used (it produces empty/garbage output or crashes inside the Capacitor Android
 * WebView; see transcriber.worker.ts). We keep the quantization-sensitive ENCODER
 * at fp32 (the only precision with reliable WASM kernels) and quantize the
 * tolerant decoder to q8 — the single biggest accuracy fix, verified to produce
 * correct output on the WASM backend.
 */
export function resolveBackend(_model: WhisperModel): BackendChoice {
  return { device: 'wasm', dtype: { encoder_model: 'fp32', decoder_model_merged: 'q8' } };
}

/** The model tiers users can choose. (All run on WASM.) */
export function availableTiers(): ModelTier[] {
  return MODEL_TIERS.filter((t) => !t.requiresWebGPU);
}

/** Default tier — `base` is the safe all-rounder. */
export function defaultModel(): WhisperModel {
  return 'Xenova/whisper-base';
}
