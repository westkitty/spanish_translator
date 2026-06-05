import { describe, expect, it } from 'vitest';
import { findSilences, segmentByGaps } from './vad';

describe('findSilences', () => {
  it('detects sustained low-energy ranges', () => {
    const sampleRate = 10;
    const pcm = new Float32Array([
      0.5, 0.5, 0.5,
      0, 0, 0, 0,
      0.4, 0.4, 0.4,
    ]);

    const silences = findSilences(pcm, sampleRate, {
      thresholdDb: -40,
      minSilenceSec: 0.3,
      frameSec: 0.1,
    });

    expect(silences).toHaveLength(1);
    expect(silences[0].start).toBeCloseTo(0.3, 5);
    expect(silences[0].end).toBeCloseTo(0.7, 5);
  });
});

describe('segmentByGaps', () => {
  it('splits words around silence ranges', () => {
    const words = [
      { id: 'word-0', text: 'hola', start: 0, end: 0.5 },
      { id: 'word-1', text: 'mundo', start: 1.2, end: 1.7 },
    ];

    expect(segmentByGaps(words, [{ start: 0.6, end: 1.1 }])).toEqual([[words[0]], [words[1]]]);
  });

  it('splits when a silence overlaps the gap instead of fitting inside it exactly', () => {
    const words = [
      { id: 'word-0', text: 'hola', start: 0, end: 0.5 },
      { id: 'word-1', text: 'mundo', start: 1.2, end: 1.7 },
    ];

    expect(segmentByGaps(words, [{ start: 0.4, end: 1.3 }])).toEqual([[words[0]], [words[1]]]);
  });
});
