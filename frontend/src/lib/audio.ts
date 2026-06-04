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
