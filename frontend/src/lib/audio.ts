// Decodes any browser-supported audio File into the 16 kHz mono Float32 PCM that
// Whisper expects. Runs on the main thread (Web Audio API is not reliably available
// inside workers), then the raw samples are transferred to the inference worker.

const WHISPER_SAMPLE_RATE = 16000;

export interface DecodedAudio {
  samples: Float32Array;
  duration: number; // seconds
}

export async function decodeAudioFile(file: File): Promise<DecodedAudio> {
  const arrayBuffer = await file.arrayBuffer();

  // A temporary context just to decode the compressed bytes to PCM.
  const AudioCtx: typeof AudioContext =
    window.AudioContext || (window as any).webkitAudioContext;
  const decodeCtx = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuffer);
  } finally {
    decodeCtx.close();
  }

  // Resample to 16 kHz mono via an OfflineAudioContext. Connecting the (possibly
  // multi-channel) source to a single-channel destination downmixes to mono.
  const frameCount = Math.max(1, Math.ceil(decoded.duration * WHISPER_SAMPLE_RATE));
  const offline = new OfflineAudioContext(1, frameCount, WHISPER_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start(0);
  const rendered = await offline.startRendering();

  return {
    samples: rendered.getChannelData(0),
    duration: decoded.duration,
  };
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

export function encodeWav(pcm: Float32Array, sampleRate = WHISPER_SAMPLE_RATE): Blob {
  const bytesPerSample = 2;
  const dataSize = pcm.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < pcm.length; i++) {
    const sample = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Downsample a Float32 PCM buffer into a normalized peak-amplitude envelope.
 * Returns `buckets` values in [0, 1] — one per time-slice of the audio — which
 * AudioCanvas uses to draw the real waveform without keeping the full PCM in
 * memory after the fact.
 */
export function computePeaks(samples: Float32Array, buckets = 800): number[] {
  const peaks = new Array<number>(buckets).fill(0);
  const bucketSize = samples.length / buckets;

  for (let b = 0; b < buckets; b++) {
    const start = Math.floor(b * bucketSize);
    const end = Math.min(samples.length, Math.floor((b + 1) * bucketSize));
    let max = 0;
    for (let i = start; i < end; i++) {
      const abs = Math.abs(samples[i]);
      if (abs > max) max = abs;
    }
    peaks[b] = max;
  }

  // Normalize so the loudest bucket = 1.0.
  let globalMax = 1e-6;
  for (let i = 0; i < peaks.length; i++) {
    if (peaks[i] > globalMax) globalMax = peaks[i];
  }
  for (let i = 0; i < peaks.length; i++) {
    peaks[i] = peaks[i] / globalMax;
  }

  return peaks;
}

export async function extractWavClip(file: File, startSec: number, endSec: number): Promise<Blob> {
  const decoded = await decodeAudioFile(file);
  const startSample = Math.max(0, Math.floor(Math.min(startSec, endSec) * WHISPER_SAMPLE_RATE));
  const endSample = Math.min(
    decoded.samples.length,
    Math.ceil(Math.max(startSec, endSec) * WHISPER_SAMPLE_RATE)
  );

  return encodeWav(decoded.samples.slice(startSample, endSample), WHISPER_SAMPLE_RATE);
}
