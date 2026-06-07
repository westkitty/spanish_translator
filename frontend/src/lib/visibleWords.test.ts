import { describe, it, expect } from 'vitest';
import { selectVisibleWords, safePlayhead } from './visibleWords';

const words = [
  { id: 'a', start: 11.92, end: 11.92 }, // zero-duration, after a 12s intro
  { id: 'b', start: 12.3, end: 12.6 },
  { id: 'c', start: 20.0, end: 20.4 },
  { id: 'd', start: 200.0, end: 200.5 },
  { id: 'e', start: 506.1, end: 506.3 },
];

describe('safePlayhead', () => {
  it('passes finite values through', () => {
    expect(safePlayhead(12.5)).toBe(12.5);
    expect(safePlayhead(0)).toBe(0);
  });
  it('coerces NaN / Infinity / negatives to a usable value', () => {
    expect(safePlayhead(NaN)).toBe(0);
    expect(safePlayhead(Infinity)).toBe(0);
    expect(safePlayhead(-5)).toBe(0);
  });
});

describe('selectVisibleWords', () => {
  it('returns [] only when there are no words at all', () => {
    expect(selectVisibleWords([], 0, 25, -8)).toEqual([]);
  });

  it('shows words within the time window at the start (currentTime 0)', () => {
    const vis = selectVisibleWords(words, 0, 25, -8);
    expect(vis.map((w) => w.id)).toEqual(['a', 'b', 'c']);
  });

  // The actual device bug: audio clock never became valid -> currentTime NaN.
  it('NEVER blanks the transcript when currentTime is NaN', () => {
    const vis = selectVisibleWords(words, NaN, 25, -8);
    expect(vis.length).toBeGreaterThan(0);
    expect(vis.map((w) => w.id)).toContain('a');
  });

  it('falls back to nearest words when the window lands in a gap', () => {
    // 60s is in the empty stretch between 20.4 and 200; window [52,77] is empty.
    const vis = selectVisibleWords(words, 60, 25, -8);
    expect(vis.length).toBeGreaterThan(0);
  });

  it('never returns empty for any finite playhead within the media', () => {
    for (let t = 0; t <= 510; t += 7) {
      expect(selectVisibleWords(words, t, 25, -8).length).toBeGreaterThan(0);
    }
  });

  it('still works when every timestamp is identical (degenerate alignment)', () => {
    const degenerate = [
      { id: 'x', start: 11.92, end: 11.92 },
      { id: 'y', start: 11.92, end: 11.92 },
      { id: 'z', start: 11.92, end: 11.92 },
    ];
    expect(selectVisibleWords(degenerate, 300, 25, -8).length).toBe(3);
    expect(selectVisibleWords(degenerate, NaN, 25, -8).length).toBe(3);
  });
});
