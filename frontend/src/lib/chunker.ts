// Splits a long PCM signal into bounded, overlapping windows so the inference
// worker can process one window at a time — keeping peak memory ~one window
// instead of the whole file (OOM prevention for long audio).

export interface Window {
  index: number;
  startSample: number;
  endSample: number;
  startSec: number;
  endSec: number;
}

export function planWindows(
  totalSamples: number,
  sampleRate: number,
  windowSec: number,
  overlapSec: number
): Window[] {
  const windowSamples = Math.round(windowSec * sampleRate);
  const hop = Math.max(1, Math.round((windowSec - overlapSec) * sampleRate));

  if (totalSamples <= windowSamples) {
    return [
      {
        index: 0,
        startSample: 0,
        endSample: totalSamples,
        startSec: 0,
        endSec: totalSamples / sampleRate,
      },
    ];
  }

  const windows: Window[] = [];
  let start = 0;
  let i = 0;
  while (start < totalSamples) {
    const end = Math.min(start + windowSamples, totalSamples);
    windows.push({
      index: i,
      startSample: start,
      endSample: end,
      startSec: start / sampleRate,
      endSec: end / sampleRate,
    });
    if (end >= totalSamples) break;
    start += hop;
    i++;
  }
  return windows;
}

export function sliceSamples(pcm: Float32Array, w: Window): Float32Array {
  return pcm.subarray(w.startSample, w.endSample);
}
