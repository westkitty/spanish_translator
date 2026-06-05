import { describe, it, expect } from 'vitest';
import { mergeWindowed, type TimedItem } from './merge';
import type { Window } from './chunker';

const win = (index: number, startSec: number, endSec: number): Window => ({
  index,
  startSample: 0,
  endSample: 0,
  startSec,
  endSec,
});

describe('mergeWindowed', () => {
  it('offsets timestamps and de-duplicates the overlap region', () => {
    // Two windows: [0,28] and [24,52]. Overlap 24..28, midpoint 26.
    const windows = [win(0, 0, 28), win(1, 24, 52)];

    const w0: TimedItem[] = [
      { text: 'a', start: 1, end: 2 }, // abs 1-2, kept
      { text: 'seam', start: 25, end: 25.5 }, // abs center 25.25 < 26, kept (owned by w0)
      { text: 'dup', start: 27, end: 27.5 }, // abs center 27.25 >= 26, dropped
    ];
    const w1: TimedItem[] = [
      { text: 'seam', start: 1, end: 1.5 }, // abs 25-25.5, center 25.25 < 26 -> dropped (owned by w0)
      { text: 'b', start: 5, end: 6 }, // abs 29-30, kept
    ];

    const merged = mergeWindowed([w0, w1], windows);
    expect(merged.map((m) => m.text)).toEqual(['a', 'seam', 'b']);
    expect(merged.map((m) => m.start)).toEqual([1, 25, 29]);
  });

  it('passes a single window through with offset', () => {
    const windows = [win(0, 0, 28)];
    const merged = mergeWindowed([[{ text: 'x', start: 3, end: 4 }]], windows);
    expect(merged).toEqual([{ text: 'x', start: 3, end: 4 }]);
  });
});
