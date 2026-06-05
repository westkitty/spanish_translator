import { describe, it, expect } from 'vitest';
import {
  removeDcOffset,
  highPassFilter,
  peakNormalize,
  detectClipping,
  preprocessForWhisper,
  rms,
} from './audiodsp';

function makeSine(freq: number, sampleRate: number, seconds: number, amp = 0.5): Float32Array {
  const n = Math.floor(sampleRate * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  return out;
}

describe('removeDcOffset', () => {
  it('subtracts the mean so the result is zero-centered', () => {
    const sig = new Float32Array([1, 1, 2, 2]); // mean 1.5
    const out = removeDcOffset(sig);
    const mean = out.reduce((a, b) => a + b, 0) / out.length;
    expect(Math.abs(mean)).toBeLessThan(1e-6);
  });
  it('does not mutate the input', () => {
    const sig = new Float32Array([1, 2, 3]);
    removeDcOffset(sig);
    expect(Array.from(sig)).toEqual([1, 2, 3]);
  });
});

describe('highPassFilter', () => {
  it('strongly attenuates a DC offset', () => {
    const sr = 16000;
    const dc = new Float32Array(sr).fill(0.8);
    const out = highPassFilter(dc, sr, 80);
    // After the transient, a one-pole high-pass drives constant input toward 0.
    const tail = out.subarray(out.length - 1000);
    const tailMean = tail.reduce((a, b) => a + b, 0) / tail.length;
    expect(Math.abs(tailMean)).toBeLessThan(0.05);
  });
  it('largely preserves a mid-band speech-range tone', () => {
    const sr = 16000;
    const tone = makeSine(1000, sr, 0.5, 0.5);
    const out = highPassFilter(tone, sr, 80);
    // 1 kHz is far above an 80 Hz cutoff, so amplitude should be mostly intact.
    expect(rms(out)).toBeGreaterThan(rms(tone) * 0.7);
  });
});

describe('peakNormalize', () => {
  it('scales so the loudest sample hits the target peak', () => {
    const sig = new Float32Array([0.1, -0.2, 0.05]);
    const out = peakNormalize(sig, 0.9);
    const peak = Math.max(...Array.from(out, Math.abs));
    expect(peak).toBeCloseTo(0.9, 5);
  });
  it('leaves a silent signal untouched (no divide-by-zero)', () => {
    const sig = new Float32Array([0, 0, 0]);
    const out = peakNormalize(sig, 0.9);
    expect(Array.from(out)).toEqual([0, 0, 0]);
  });
});

describe('detectClipping', () => {
  it('flags samples at/over the threshold', () => {
    const sig = new Float32Array([0.1, 1.0, -1.0, 0.5]);
    const r = detectClipping(sig, 0.99);
    expect(r.clippedSamples).toBe(2);
    expect(r.ratio).toBeCloseTo(0.5, 5);
  });
  it('reports clean audio as not clipped', () => {
    const r = detectClipping(new Float32Array([0.1, 0.2, 0.3]), 0.99);
    expect(r.clippedSamples).toBe(0);
    expect(r.clipped).toBe(false);
  });
});

describe('preprocessForWhisper', () => {
  it('returns a same-length array and removes DC', () => {
    const sr = 16000;
    const sig = makeSine(440, sr, 0.25, 0.3).map((v) => v + 0.4) as Float32Array;
    const out = preprocessForWhisper(sig, sr);
    expect(out.length).toBe(sig.length);
    const mean = out.reduce((a, b) => a + b, 0) / out.length;
    expect(Math.abs(mean)).toBeLessThan(0.02);
  });
  it('brings a very quiet signal up toward the target level', () => {
    const sr = 16000;
    const quiet = makeSine(500, sr, 0.5, 0.02); // very quiet
    const out = preprocessForWhisper(quiet, sr);
    expect(rms(out)).toBeGreaterThan(rms(quiet) * 2);
  });
});
