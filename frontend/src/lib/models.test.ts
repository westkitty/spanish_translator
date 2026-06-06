import { describe, it, expect } from 'vitest';
import { MODEL_TIERS, resolveBackend, availableTiers, defaultModel, type WhisperModel } from './models';

describe('MODEL_TIERS', () => {
  it('lists the WASM tiers with unique ids', () => {
    const ids = MODEL_TIERS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('Xenova/whisper-tiny');
    expect(ids).toContain('Xenova/whisper-base');
    expect(ids).toContain('Xenova/whisper-small');
  });
  it('does not offer a WebGPU-only tier (WASM-only app)', () => {
    expect(MODEL_TIERS.some((t) => t.requiresWebGPU)).toBe(false);
  });
});

describe('resolveBackend', () => {
  it('always uses the WASM backend with fp32 encoder + q8 decoder', () => {
    const b = resolveBackend('Xenova/whisper-small');
    expect(b.device).toBe('wasm');
    expect(b.dtype).toEqual({ encoder_model: 'fp32', decoder_model_merged: 'q8' });
  });
});

describe('availableTiers', () => {
  it('returns all (WASM) tiers', () => {
    expect(availableTiers().length).toBe(MODEL_TIERS.length);
    expect(availableTiers().map((t) => t.id)).toContain('Xenova/whisper-base');
  });
});

describe('defaultModel', () => {
  it('returns a valid tier id', () => {
    const id: WhisperModel = defaultModel();
    expect(MODEL_TIERS.some((t) => t.id === id)).toBe(true);
  });
});
