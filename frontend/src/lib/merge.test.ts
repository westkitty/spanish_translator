import { describe, it, expect } from 'vitest';
import { mergeWindowed, silenceAwareCuts, type TimedItem } from './merge';
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

  it('honors explicit cut points (silence-aware) over the midpoint', () => {
    const windows = [win(0, 0, 28), win(1, 24, 52)];
    const w0: TimedItem[] = [{ text: 'seam', start: 25, end: 25.5 }]; // abs center 25.25
    const w1: TimedItem[] = [{ text: 'seam', start: 1, end: 1.5 }]; // abs center 25.25
    // Force the cut earlier than the seam word (24.5): now the LATER window owns it.
    const merged = mergeWindowed([w0, w1], windows, [24.5]);
    expect(merged.map((m) => m.start)).toEqual([25]); // single, deduped
    // The kept copy came from w1 (offset 24, local start 1 -> abs 25).
    expect(merged).toHaveLength(1);
  });
});

describe('silenceAwareCuts', () => {
  it('snaps the cut to a silence center inside the overlap', () => {
    const windows = [win(0, 0, 28), win(1, 24, 52)]; // overlap 24..28, nominal mid 26
    const cuts = silenceAwareCuts(windows, [{ start: 24.5, end: 25.5 }], 2); // center 25
    expect(cuts).toEqual([25]);
  });
  it('falls back to the midpoint when no silence overlaps', () => {
    const windows = [win(0, 0, 28), win(1, 24, 52)];
    const cuts = silenceAwareCuts(windows, [{ start: 5, end: 6 }], 2);
    expect(cuts).toEqual([26]);
  });
  it('ignores silences beyond the max shift from the midpoint', () => {
    const windows = [win(0, 0, 28), win(1, 24, 52)];
    // Silence center 24.25 is >2s from nominal 26 -> keep midpoint.
    const cuts = silenceAwareCuts(windows, [{ start: 24, end: 24.5 }], 1);
    expect(cuts).toEqual([26]);
  });
});
