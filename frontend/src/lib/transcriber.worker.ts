/// <reference lib="webworker" />
// On-device Whisper inference worker. Loads a quantized Whisper model via
// Transformers.js (ONNX Runtime / WASM), keeps it cached across runs, and emits
// word-level timestamped segments. Nothing leaves the device; no server involved.

import { pipeline, env } from '@huggingface/transformers';

// Pull model weights from the Hugging Face hub on first run (cached in the
// browser Cache API afterwards → offline forever). The ONNX Runtime WASM binary
// is bundled locally by Vite (emitted into assets/ via import.meta.url), so the
// runtime needs no network — only the one-time model download does.
env.allowLocalModels = false;
const wasm = env.backends?.onnx?.wasm;
if (wasm) {
  // Single-threaded keeps us off SharedArrayBuffer / COOP-COEP, which is awkward
  // inside the Capacitor WebView. Slower but universally reliable.
  wasm.numThreads = 1;
}

export type WhisperModel = 'Xenova/whisper-base' | 'Xenova/whisper-tiny';
export type WhisperTask = 'transcribe' | 'translate';

interface RunMessage {
  type: 'run';
  audio: Float32Array;
  model: WhisperModel;
  task: WhisperTask;
  language: string | null; // e.g. 'spanish', 'english', or null = auto-detect
}

type IncomingMessage = RunMessage;

// One cached pipeline per model id so switching size doesn't reload needlessly.
// Typed as `any`: the fully-resolved pipeline union is too large for tsc.
const pipelines = new Map<WhisperModel, Promise<any>>();

function getPipeline(model: WhisperModel): Promise<any> {
  let p = pipelines.get(model);
  if (!p) {
    p = pipeline('automatic-speech-recognition', model, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (progress: any) => {
        self.postMessage({ type: 'model-progress', progress });
      },
    });
    pipelines.set(model, p);
  }
  return p;
}

self.addEventListener('message', async (event: MessageEvent<IncomingMessage>) => {
  const msg = event.data;
  if (msg.type !== 'run') return;

  try {
    self.postMessage({ type: 'status', status: 'loading-model' });
    const transcriber = await getPipeline(msg.model);

    self.postMessage({ type: 'status', status: 'transcribing' });
    const output: any = await transcriber(msg.audio, {
      language: msg.language ?? undefined,
      task: msg.task,
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    // output.chunks: [{ text, timestamp: [start, end] }]
    const chunks: Array<{ text: string; timestamp: [number, number | null] }> =
      output?.chunks ?? [];

    const words = chunks
      .filter((c) => c.text && c.text.trim().length > 0)
      .map((c, idx) => ({
        id: `word-${idx}`,
        text: c.text.trim(),
        start: c.timestamp?.[0] ?? 0,
        end: c.timestamp?.[1] ?? c.timestamp?.[0] ?? 0,
      }));

    self.postMessage({ type: 'result', words, text: output?.text ?? '' });
  } catch (err: any) {
    self.postMessage({ type: 'error', message: err?.message ?? String(err) });
  }
});
