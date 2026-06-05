/// <reference lib="webworker" />
// On-device Whisper inference worker. Loads a quantized Whisper model via
// Transformers.js (ONNX Runtime / WASM) and processes the audio in bounded,
// overlapping WINDOWS — one at a time — so long files never exhaust memory.
// After each window it reports the wall-clock time it took, letting the main
// thread compute a device-calibrated ETA. Nothing leaves the device.

import { pipeline, env } from '@huggingface/transformers';
import { planWindows, sliceSamples } from './chunker';
import { mergeWindowed, silenceAwareCuts, type TimedItem } from './merge';
import { preprocessForWhisper } from './audiodsp';
import { findSilences } from './vad';
import { collapseRepeatedPhrases } from './dehallucinate';
import { resolveBackend, detectWebGPU, type WhisperModel } from './models';

env.allowLocalModels = false;
const wasm = env.backends?.onnx?.wasm;
if (wasm) {
  // Single-threaded keeps us off SharedArrayBuffer / COOP-COEP, which is awkward
  // inside the Capacitor WebView. Slower but universally reliable.
  wasm.numThreads = 1;
}

// Detected once per worker. WebGPU (when present) unlocks fp16 + the larger
// tiers at a usable speed; otherwise we fall back to the fp32-encoder WASM path.
const HAS_WEBGPU = detectWebGPU();

export type { WhisperModel };

const SAMPLE_RATE = 16000;
const WINDOW_SEC = 28;
const OVERLAP_SEC = 4;

interface RunMessage {
  type: 'run';
  audio: Float32Array;
  model: WhisperModel;
  language: string; // source language of the audio, e.g. 'spanish'
  prompt?: string; // optional vocabulary hint
  highAccuracy?: boolean; // beam search vs greedy
  offsetSec?: number;
}
interface CancelMessage {
  type: 'cancel';
}
type IncomingMessage = RunMessage | CancelMessage;

let cancelRequested = false;

// One cached pipeline per model id so switching size doesn't reload needlessly.
// Typed as `any`: the fully-resolved pipeline union is too large for tsc.
const pipelines = new Map<WhisperModel, Promise<any>>();

function getPipeline(model: WhisperModel): Promise<any> {
  let p = pipelines.get(model);
  if (!p) {
    // Device + quantization policy lives in models.ts. On WASM: fp32 encoder
    // (the encoder is extremely quantization-sensitive — q8 there was the
    // biggest hidden accuracy loss) + q8 decoder. On WebGPU: fp16 throughout.
    // Ref: https://huggingface.co/docs/transformers.js/guides/dtypes
    const backend = resolveBackend(model, HAS_WEBGPU);
    p = pipeline('automatic-speech-recognition', model, {
      dtype: backend.dtype as any,
      device: backend.device,
      progress_callback: (progress: any) => {
        self.postMessage({ type: 'model-progress', progress });
      },
    });
    pipelines.set(model, p);
  }
  return p;
}


function toItems(output: any): TimedItem[] {
  if (!output) return [];
  
  const chunks: any[] = output.chunks ?? (Array.isArray(output) ? output : []);
  
  return chunks
    .filter((c) => c && (c.text || c.word))
    .map((c) => {
      const textVal = (c.text ?? c.word ?? '').trim();
      
      let start = 0;
      let end = 0;
      
      if (Array.isArray(c.timestamp)) {
        start = c.timestamp[0] ?? 0;
        end = c.timestamp[1] ?? start;
      } else if (c.start !== undefined) {
        start = c.start;
        end = c.end ?? start;
      }
      
      return {
        text: textVal,
        start: start,
        end: end
      };
    })
    .filter((item) => item.text.length > 0);
}

self.addEventListener('message', async (event: MessageEvent<IncomingMessage>) => {
  const msg = event.data;

  if (msg.type === 'cancel') {
    cancelRequested = true;
    return;
  }
  if (msg.type !== 'run') return;

  cancelRequested = false;

  try {
    self.postMessage({ type: 'status', status: 'loading-model' });
    const transcriber = await getPipeline(msg.model);

    // Pre-inference clean-up: DC removal + high-pass (drop sub-80 Hz rumble) +
    // loudness normalization, so quiet/rumbly recordings reach Whisper at the
    // speech level it was trained on. Pure DSP — see audiodsp.ts.
    const audio = preprocessForWhisper(msg.audio, SAMPLE_RATE);

    // Map the silences once so window handoffs can land between words instead of
    // mid-word (see silenceAwareCuts), and so we know where hallucination is most
    // likely. Thresholds are relative to the loudness-normalized signal.
    const silences = findSilences(audio, SAMPLE_RATE, {
      thresholdDb: -45,
      minSilenceSec: 0.4,
    });

    const windows = planWindows(audio.length, SAMPLE_RATE, WINDOW_SEC, OVERLAP_SEC);
    // Two passes (transcribe + translate) per window = total work units.
    self.postMessage({ type: 'plan', windowCount: windows.length, passes: 2 });

    const txPerWindow: TimedItem[][] = [];
    const trPerWindow: TimedItem[][] = [];

    for (const w of windows) {
      if (cancelRequested) {
        self.postMessage({ type: 'cancelled' });
        return;
      }

      const slice = sliceSamples(audio, w);
      const beams = msg.highAccuracy ? { num_beams: 5 } : {};
      // Block verbatim n-gram loops — Whisper's most common hallucination on
      // silence/music. Cheap (no extra decode passes) and backend-agnostic.
      const antiRepeat = { no_repeat_ngram_size: 3 };

      // Pass 1 — transcript (Spanish), word-level timestamps.
      self.postMessage({ type: 'status', status: 'transcribing' });
      let t0 = performance.now();
      const txOutput: any = await transcriber(slice, {
        language: msg.language,
        task: 'transcribe',
        return_timestamps: 'word',
        chunk_length_s: 30,
        stride_length_s: 5,
        ...beams,
        ...antiRepeat,
        ...(msg.prompt ? { prompt: msg.prompt } : {}),
      });
      txPerWindow.push(toItems(txOutput));
      self.postMessage({
        type: 'window',
        pass: 'transcribe',
        windowIndex: w.index,
        wallMs: performance.now() - t0,
      });

      if (cancelRequested) {
        self.postMessage({ type: 'cancelled' });
        return;
      }

      // Pass 2 — English translation, segment-level timestamps.
      self.postMessage({ type: 'status', status: 'translating' });
      t0 = performance.now();
      const trOutput: any = await transcriber(slice, {
        language: msg.language,
        task: 'translate',
        return_timestamps: true,
        chunk_length_s: 30,
        stride_length_s: 5,
        ...beams,
        ...antiRepeat,
      });
      trPerWindow.push(toItems(trOutput));
      self.postMessage({
        type: 'window',
        pass: 'translate',
        windowIndex: w.index,
        wallMs: performance.now() - t0,
      });
    }

    // Snap window handoffs to silences, then repair any verbatim repetition
    // loops that survived across seams.
    const cuts = silenceAwareCuts(windows, silences, 2);
    const wordItems = collapseRepeatedPhrases(mergeWindowed(txPerWindow, windows, cuts), {
      maxRepeats: 2,
      maxPhraseLen: 6,
    });
    const segItems = collapseRepeatedPhrases(mergeWindowed(trPerWindow, windows, cuts), {
      maxRepeats: 2,
      maxPhraseLen: 6,
    });
    const offsetSec = msg.offsetSec ?? 0;

    const words = wordItems.map((it, idx) => ({
      id: `word-${idx}`,
      text: it.text,
      start: it.start + offsetSec,
      end: it.end + offsetSec,
    }));
    const segments = segItems.map((it, idx) => ({
      id: `seg-${idx}`,
      text: it.text,
      start: it.start + offsetSec,
      end: it.end + offsetSec,
    }));
    const translationText = segments.map((s) => s.text).join(' ');

    self.postMessage({
      type: 'result',
      words,
      text: words.map((w) => w.text).join(' '),
      translation: { segments, text: translationText },
    });
  } catch (err: any) {
    self.postMessage({ type: 'error', message: err?.message ?? String(err) });
  }
});
