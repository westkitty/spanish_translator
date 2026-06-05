// Device-calibrated ETA. Work is measured in "units" (one Whisper pass over one
// window). We record the wall-clock time each unit actually took on THIS device,
// then extrapolate the remaining units from the measured average. Because the
// estimate comes from real measured timings, it self-calibrates to the device's
// actual speed rather than guessing.

export class EtaEstimator {
  private readonly totalUnits: number;
  private readonly times: number[] = [];
  private readonly startedAt: number;

  constructor(totalUnits: number, now: number = Date.now()) {
    this.totalUnits = Math.max(0, totalUnits);
    this.startedAt = now;
  }

  /** Record how long one completed unit of work took, in milliseconds. */
  record(ms: number): void {
    this.times.push(ms);
  }

  private averageMs(): number | null {
    if (this.times.length === 0) return null;
    // Weight the most recent samples a little higher so the estimate tracks
    // changing conditions (e.g. thermal throttling) without being jumpy.
    let weightedSum = 0;
    let weightTotal = 0;
    this.times.forEach((t, i) => {
      const weight = 1 + i * 0.15;
      weightedSum += t * weight;
      weightTotal += weight;
    });
    return weightedSum / weightTotal;
  }

  /** Estimated milliseconds remaining, or null until at least one unit is timed. */
  remainingMs(): number | null {
    const avg = this.averageMs();
    if (avg === null) return null;
    const remainingUnits = Math.max(0, this.totalUnits - this.times.length);
    return avg * remainingUnits;
  }

  /** Completed fraction in [0, 1]. */
  fraction(): number {
    if (this.totalUnits === 0) return 1;
    return Math.min(1, this.times.length / this.totalUnits);
  }

  elapsedMs(now: number = Date.now()): number {
    return now - this.startedAt;
  }
}
