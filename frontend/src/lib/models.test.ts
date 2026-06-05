import { describe, it, expect } from 'vitest';
import {
  MODEL_TIERS,
  resolveBackend,
  availableTiers,
  defaultModel,
  type WhisperModel,
} from './models';

describe('MODEL_TIERS', () => {
  it('lists tiers from fast to best with unique ids', () => {
    const ids = MODEL_TIERS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('Xenova/whisper-tiny');
    expect(ids).toContain('Xenova/whisper-base');
    expect(ids).toContain('Xenova/whisper-small');
  });
  it('marks the large/turbo tier as WebGPU-only', () => {
    const best = MODEL_TIERS.find((t) => t.requiresWebGPU);
    expect(best).toBeTruthy();
    expect(best!.id).toContain('turbo');
  });
});

describe('resolveBackend', () => {
  it('uses fp32 encoder + q8 decoder on the WASM/CPU backend', () => {
    const b = resolveBackend('Xenova/whisper-small', false);
    expect(b.device).toBe('wasm');
    expect(b.dtype).toEqual({ encoder_model: 'fp32', decoder_model_merged: 'q8' });
  });
  it('uses fp16 on the WebGPU backend', () => {
    const b = resolveBackend('Xenova/whisper-small', true);
    expect(b.device).toBe('webgpu');
    expect(b.dtype).toBe('fp16');
  });
});

describe('availableTiers', () => {
  it('hides WebGPU-only tiers when WebGPU is absent', () => {
    const ids = availableTiers(false).map((t) => t.id);
    expect(ids.some((id) => id.includes('turbo'))).toBe(false);
    expect(ids).toContain('Xenova/whisper-base');
  });
  it('includes every tier when WebGPU is present', () => {
    expect(availableTiers(true).length).toBe(MODEL_TIERS.length);
  });
});

describe('defaultModel', () => {
  it('returns a valid tier id', () => {
    const id: WhisperModel = defaultModel(false);
    expect(MODEL_TIERS.some((t) => t.id === id)).toBe(true);
  });
});
