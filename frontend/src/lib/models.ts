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

// Ordered fast → best.
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
  {
    id: 'onnx-community/whisper-large-v3-turbo',
    label: 'Best',
    blurb: 'Large-v3 Turbo — top accuracy. Needs a WebGPU device (large download).',
    requiresWebGPU: true,
  },
];

export interface BackendChoice {
  device: 'webgpu' | 'wasm';
  // `dtype` is passed straight to the Transformers.js pipeline. It is either a
  // single precision or a per-module map.
  dtype: 'fp16' | { encoder_model: string; decoder_model_merged: string };
}

/**
 * Choose device + quantization for a model.
 *
 * - **WASM/CPU:** keep the quantization-sensitive ENCODER at fp32 (the only
 *   precision with reliable WASM kernels) and quantize the tolerant decoder to
 *   q8. This is the single biggest accuracy fix from Phase 1.
 * - **WebGPU:** fp16 throughout — well-supported on GPU, fast, and far more
 *   accurate than q8, which is what makes the small/turbo tiers practical.
 */
export function resolveBackend(_model: WhisperModel, hasWebGPU: boolean): BackendChoice {
  if (hasWebGPU) {
    return { device: 'webgpu', dtype: 'fp16' };
  }
  return { device: 'wasm', dtype: { encoder_model: 'fp32', decoder_model_merged: 'q8' } };
}

/** True if the current context exposes WebGPU (main thread or worker). */
export function detectWebGPU(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

/** Tiers the device can actually run. */
export function availableTiers(hasWebGPU: boolean): ModelTier[] {
  return MODEL_TIERS.filter((t) => !t.requiresWebGPU || hasWebGPU);
}

/**
 * Default tier. We keep `base` as the safe default even on WebGPU until on-device
 * benchmarking confirms `small` is fast enough to promote — flipping this is a
 * one-line change once the eval harness has device numbers.
 */
export function defaultModel(_hasWebGPU: boolean): WhisperModel {
  return 'Xenova/whisper-base';
}
