import { describe, it, expect } from 'vitest';
import { EtaEstimator } from './eta';

describe('EtaEstimator', () => {
  it('returns null before any unit is recorded', () => {
    const e = new EtaEstimator(10);
    expect(e.remainingMs()).toBeNull();
    expect(e.fraction()).toBe(0);
  });

  it('extrapolates remaining time from measured units', () => {
    const e = new EtaEstimator(10);
    e.record(1000);
    e.record(1000);
    // 8 units remain at ~1000ms each
    expect(e.remainingMs()).toBeCloseTo(8000, 0);
    expect(e.fraction()).toBeCloseTo(0.2, 5);
  });

  it('weights recent samples higher (tracks a slowdown)', () => {
    const e = new EtaEstimator(4);
    e.record(1000);
    e.record(3000); // recent unit much slower
    const remaining = e.remainingMs()!;
    // Simple mean would predict 2000 * 2 = 4000; weighted leans toward the slower recent sample.
    expect(remaining).toBeGreaterThan(4000);
  });

  it('reports complete when total units reached', () => {
    const e = new EtaEstimator(2);
    e.record(500);
    e.record(500);
    expect(e.fraction()).toBe(1);
    expect(e.remainingMs()).toBe(0);
  });

  it('uses injected clock for elapsed', () => {
    const e = new EtaEstimator(3, 1000);
    expect(e.elapsedMs(4000)).toBe(3000);
  });
});
