import { describe, expect, it } from 'vitest';
import { replaceTimedRange } from './timeline';

describe('replaceTimedRange', () => {
  it('replaces only items overlapping the selected range', () => {
    const items = [
      { id: 'word-0', text: 'uno', start: 0, end: 1 },
      { id: 'word-1', text: 'dos', start: 2, end: 3 },
      { id: 'word-2', text: 'tres', start: 4, end: 5 },
    ];
    const replacements = [
      { id: 'word-x', text: 'nuevo', start: 2.1, end: 2.8 },
    ];

    const merged = replaceTimedRange(items, replacements, { start: 1.5, end: 3.5 }, 'word');

    expect(merged).toEqual([
      { id: 'word-0', text: 'uno', start: 0, end: 1 },
      { id: 'word-1', text: 'nuevo', start: 2.1, end: 2.8 },
      { id: 'word-2', text: 'tres', start: 4, end: 5 },
    ]);
  });

  it('normalizes reversed ranges', () => {
    const items = [
      { id: 'seg-0', text: 'before', start: 0, end: 1 },
      { id: 'seg-1', text: 'inside', start: 2, end: 3 },
    ];

    const merged = replaceTimedRange(items, [], { start: 3.5, end: 1.5 }, 'seg');

    expect(merged).toEqual([{ id: 'seg-0', text: 'before', start: 0, end: 1 }]);
  });
});
