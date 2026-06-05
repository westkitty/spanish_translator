import { describe, it, expect } from 'vitest';
import { planWindows, sliceSamples } from './chunker';

describe('planWindows', () => {
  it('covers the whole signal with overlapping windows', () => {
    const w = planWindows(16000 * 60, 16000, 28, 4); // 60s @ 16kHz
    expect(w[0].startSec).toBe(0);
    // windows advance by (window - overlap) = 24s
    expect(w[1].startSec).toBeCloseTo(24, 5);
    expect(w[w.length - 1].endSample).toBe(16000 * 60);
    // every window covers up to the next window's start (no gaps)
    for (let i = 1; i < w.length; i++) {
      expect(w[i].startSec).toBeLessThan(w[i - 1].endSec);
    }
  });

  it('returns a single window for short clips', () => {
    const w = planWindows(16000 * 10, 16000, 28, 4);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ index: 0, startSample: 0, endSample: 160000 });
  });
});

describe('sliceSamples', () => {
  it('returns the sub-range without copying', () => {
    const pcm = new Float32Array([0, 1, 2, 3, 4, 5]);
    const slice = sliceSamples(pcm, { index: 0, startSample: 2, endSample: 5, startSec: 0, endSec: 0 });
    expect(Array.from(slice)).toEqual([2, 3, 4]);
  });
});
