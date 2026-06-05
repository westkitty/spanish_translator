// Pure DSP helpers applied to 16 kHz mono Float32 PCM *before* it reaches the
// Whisper worker. Whisper was trained on roughly speech-level audio, so very
// quiet, DC-offset, or rumbly inputs degrade recognition. These are deliberately
// simple, deterministic, and unit-tested — no Web Audio, no DOM, no allocations
// beyond the output buffer.

/** Root-mean-square level of a signal. */
export function rms(pcm: Float32Array): number {
  if (pcm.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i];
  return Math.sqrt(sum / pcm.length);
}

/** Peak absolute amplitude. */
export function peak(pcm: Float32Array): number {
  let p = 0;
  for (let i = 0; i < pcm.length; i++) {
    const a = Math.abs(pcm[i]);
    if (a > p) p = a;
  }
  return p;
}

/** Subtract the mean (DC offset) so the signal is zero-centered. Returns a copy. */
export function removeDcOffset(pcm: Float32Array): Float32Array {
  if (pcm.length === 0) return new Float32Array(0);
  let mean = 0;
  for (let i = 0; i < pcm.length; i++) mean += pcm[i];
  mean /= pcm.length;
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] - mean;
  return out;
}

/**
 * One-pole high-pass filter. Removes sub-cutoff rumble (handling noise, HVAC,
 * mic thumps) that carries no speech information. Returns a copy.
 *
 *   y[n] = a * (y[n-1] + x[n] - x[n-1]),   a = RC / (RC + dt),  RC = 1/(2π·fc)
 */
export function highPassFilter(
  pcm: Float32Array,
  sampleRate: number,
  cutoffHz = 80
): Float32Array {
  const out = new Float32Array(pcm.length);
  if (pcm.length === 0) return out;
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRate;
  const a = rc / (rc + dt);
  out[0] = pcm[0];
  for (let i = 1; i < pcm.length; i++) {
    out[i] = a * (out[i - 1] + pcm[i] - pcm[i - 1]);
  }
  return out;
}

/** Scale so the loudest sample reaches `targetPeak`. Silent input is returned as-is. */
export function peakNormalize(pcm: Float32Array, targetPeak = 0.95): Float32Array {
  const p = peak(pcm);
  if (p < 1e-8) return pcm.slice();
  const gain = targetPeak / p;
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] * gain;
  return out;
}

/**
 * Normalize toward a target RMS (loudness), but never let the peak clip:
 * the applied gain is the smaller of the RMS gain and the gain that would put
 * the peak at `peakCeiling`. Good for bringing quiet recordings up to a
 * consistent speech level without distortion.
 */
export function rmsNormalize(
  pcm: Float32Array,
  targetRms = 0.1,
  peakCeiling = 0.97
): Float32Array {
  const r = rms(pcm);
  if (r < 1e-8) return pcm.slice();
  const rmsGain = targetRms / r;
  const p = peak(pcm);
  const peakGain = p > 1e-8 ? peakCeiling / p : rmsGain;
  const gain = Math.min(rmsGain, peakGain);
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] * gain;
  return out;
}

export interface ClippingReport {
  clippedSamples: number;
  ratio: number; // fraction of samples at/over threshold
  clipped: boolean; // true if ratio exceeds a small tolerance
}

/** Count samples at or beyond `threshold` — a proxy for input that was recorded too hot. */
export function detectClipping(
  pcm: Float32Array,
  threshold = 0.99,
  tolerance = 0.001
): ClippingReport {
  if (pcm.length === 0) return { clippedSamples: 0, ratio: 0, clipped: false };
  let clipped = 0;
  for (let i = 0; i < pcm.length; i++) {
    if (Math.abs(pcm[i]) >= threshold) clipped++;
  }
  const ratio = clipped / pcm.length;
  return { clippedSamples: clipped, ratio, clipped: ratio > tolerance };
}

/**
 * Full pre-inference chain: DC removal → high-pass → loudness normalization.
 * Returns a new buffer; the input is left untouched.
 */
export function preprocessForWhisper(pcm: Float32Array, sampleRate: number): Float32Array {
  if (pcm.length === 0) return new Float32Array(0);
  const dc = removeDcOffset(pcm);
  const hp = highPassFilter(dc, sampleRate, 80);
  return rmsNormalize(hp, 0.1, 0.97);
}
