import { describe, it, expect } from 'vitest';
import { chrf } from './chrf';

describe('chrf', () => {
  it('scores an identical translation at (near) 1', () => {
    expect(chrf('the cat sat on the mat', 'the cat sat on the mat')).toBeCloseTo(1, 5);
  });

  it('scores a completely disjoint string at 0', () => {
    expect(chrf('abcdef', 'zyxwvu')).toBe(0);
  });

  it('scores a close paraphrase between 0 and 1, high', () => {
    const s = chrf('the cat sat on the mat', 'the cat sat on a mat');
    expect(s).toBeGreaterThan(0.6);
    expect(s).toBeLessThan(1);
  });

  it('is case- and whitespace-insensitive', () => {
    expect(chrf('Hello   World', 'hello world')).toBeCloseTo(1, 5);
  });

  it('treats two empty strings as a perfect match', () => {
    expect(chrf('', '')).toBe(1);
  });

  it('treats one empty side as 0', () => {
    expect(chrf('hello', '')).toBe(0);
    expect(chrf('', 'hello')).toBe(0);
  });
});
