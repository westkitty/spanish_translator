import type { CaptionWord } from '../components/CaptionEditor';

export interface SilenceRange {
  start: number;
  end: number;
}

export interface VadOptions {
  thresholdDb: number;
  minSilenceSec: number;
  frameSec?: number;
}

export function findSilences(
  pcm: Float32Array,
  sampleRate: number,
  { thresholdDb, minSilenceSec, frameSec = 0.05 }: VadOptions
): SilenceRange[] {
  const frameSamples = Math.max(1, Math.round(frameSec * sampleRate));
  const minFrames = Math.max(1, Math.ceil(minSilenceSec / frameSec));
  const silences: SilenceRange[] = [];
  let silenceStartFrame: number | null = null;
  let frameIndex = 0;

  for (let start = 0; start < pcm.length; start += frameSamples) {
    const end = Math.min(pcm.length, start + frameSamples);
    let squareSum = 0;

    for (let i = start; i < end; i++) {
      squareSum += pcm[i] * pcm[i];
    }

    const rms = Math.sqrt(squareSum / Math.max(1, end - start));
    const db = 20 * Math.log10(Math.max(rms, 1e-8));
    const silent = db <= thresholdDb;

    if (silent && silenceStartFrame === null) {
      silenceStartFrame = frameIndex;
    }

    if (!silent && silenceStartFrame !== null) {
      if (frameIndex - silenceStartFrame >= minFrames) {
        silences.push({
          start: silenceStartFrame * frameSec,
          end: frameIndex * frameSec,
        });
      }
      silenceStartFrame = null;
    }

    frameIndex++;
  }

  if (silenceStartFrame !== null && frameIndex - silenceStartFrame >= minFrames) {
    silences.push({
      start: silenceStartFrame * frameSec,
      end: pcm.length / sampleRate,
    });
  }

  return silences;
}

export function segmentByGaps(words: CaptionWord[], silences: SilenceRange[]): CaptionWord[][] {
  const groups: CaptionWord[][] = [];
  let current: CaptionWord[] = [];

  const hasSilenceBetween = (previous: CaptionWord, next: CaptionWord) =>
    silences.some((silence) => silence.end > previous.end && silence.start < next.start);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const previous = words[i - 1];

    if (previous && hasSilenceBetween(previous, word) && current.length > 0) {
      groups.push(current);
      current = [];
    }

    current.push(word);
  }

  if (current.length > 0) {
    groups.push(current);
  }

  return groups;
}
