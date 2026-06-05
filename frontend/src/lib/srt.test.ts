import { describe, it, expect } from 'vitest';
import { formatTimestamp } from './srt';

describe('formatTimestamp', () => {
  it('formats SRT timestamps with a comma', () => {
    expect(formatTimestamp(0)).toBe('00:00:00,000');
    expect(formatTimestamp(3661.5)).toBe('01:01:01,500');
  });
  it('formats VTT timestamps with a dot', () => {
    expect(formatTimestamp(62.25, '.')).toBe('00:01:02.250');
  });
  it('carries rounded milliseconds', () => {
    expect(formatTimestamp(1.9996)).toBe('00:00:02,000');
  });
  it('never goes negative', () => {
    expect(formatTimestamp(-5)).toBe('00:00:00,000');
  });
});
