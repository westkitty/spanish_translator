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
import { collapseRepeatedPhrases, sanitizeTranslation } from './dehallucinate';
import { resolveBackend, type WhisperModel } from './models';
import { buildSentences } from './punctuation';

env.allowLocalModels = false;
const wasm = env.backends?.onnx?.wasm;
if (wasm) {
  // Single-threaded keeps us off SharedArrayBuffer / COOP-COEP, which is awkward
  // inside the Capacitor WebView. Slower but universally reliable.
  wasm.numThreads = 1;
}

export type { WhisperModel };

// NOTE: We deliberately run inference on the WASM/CPU backend only. WebGPU inside
// the Capacitor Android System WebView is unreliable — some devices expose a
// WebGPU adapter that then produces empty/garbage ONNX output (a finished run
// with no transcript) or crashes on load. WASM is slower but universally correct,
// and is what shipped working in v2.5.0. (Re-enable WebGPU only behind real,
// per-device verification — an adapter existing is not enough.)

const SAMPLE_RATE = 16000;
const WINDOW_SEC = 28;
const OVERLAP_SEC = 4;

// Dedicated Spanish→English translator. Replaces Whisper's weak built-in
// `translate` task with a purpose-built Marian/OPUS-MT model — better fluency
// and adequacy, and it removes a whole inference pass per window (≈2× faster).
// Runs on WASM at q8 (small, robust; MT tolerates q8 well) regardless of the
// ASR backend.
const TRANSLATION_MODEL = 'Xenova/opus-mt-es-en';
let translatorPromise: Promise<any> | null = null;

function getTranslator(): Promise<any> {
  if (!translatorPromise) {
    translatorPromise = pipeline('translation', TRANSLATION_MODEL, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (progress: any) => {
        self.postMessage({ type: 'model-progress', progress });
      },
    });
  }
  return translatorPromise;
}

interface Segment {
  id: string;
  text: string;
  start: number;
  end: number;
}

// Translate Spanish sentences to English, preserving each sentence's timing.
//
// One sentence per call — NOT batched. Batched seq2seq generation runs until the
// longest sequence in the batch finishes (or max_length), so shorter sentences
// keep emitting filler tokens that decode as runaway "...."/"????" tails. That
// made every sentence generate ~max_length tokens: garbage output, ~25× the
// compute, and enough memory churn to OOM-crash a phone WebView mid-run. Per
// sentence each sequence stops at its own EOS; we also cap max_new_tokens and
// block n-gram loops, then sanitize as a last line of defense.
async function translateSentences(
  sentences: { text: string; start: number; end: number }[]
): Promise<{ segments: Segment[]; text: string }> {
  if (sentences.length === 0) return { segments: [], text: '' };

  const translator = await getTranslator();
  const segments: Segment[] = [];

  for (const s of sentences) {
    if (cancelRequested) break;
    const srcWords = s.text.split(/\s+/).filter(Boolean).length;
    // Translations are roughly source-length; cap generously but finitely so a
    // degenerate decode can never run away.
    const maxNewTokens = Math.min(256, Math.max(24, srcWords * 3 + 12));

    let text = '';
    try {
      const output: any = await translator(s.text, {
        max_new_tokens: maxNewTokens,
        no_repeat_ngram_size: 3,
      });
      const arr = Array.isArray(output) ? output : [output];
      text = sanitizeTranslation((arr[0]?.translation_text ?? '').trim());
    } catch {
      text = '';
    }

    segments.push({ id: `seg-${segments.length}`, text, start: s.start, end: s.end });
  }

  return { segments, text: segments.map((s) => s.text).join(' ') };
}

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
    // Quantization policy lives in models.ts. WASM/CPU: fp32 encoder (the encoder
    // is extremely quantization-sensitive — q8 there was the biggest hidden
    // accuracy loss) + q8 decoder.
    // Ref: https://huggingface.co/docs/transformers.js/guides/dtypes
    const backend = resolveBackend(model);
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
    // One transcription pass per window now; translation is a single dedicated
    // step at the end (Opus-MT over reconstructed sentences), not per window.
    self.postMessage({ type: 'plan', windowCount: windows.length, passes: 1 });

    const txPerWindow: TimedItem[][] = [];

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
    }

    if (cancelRequested) {
      self.postMessage({ type: 'cancelled' });
      return;
    }

    // Snap window handoffs to silences, then repair any verbatim repetition
    // loops that survived across seams.
    const cuts = silenceAwareCuts(windows, silences, 2);
    const wordItems = collapseRepeatedPhrases(mergeWindowed(txPerWindow, windows, cuts), {
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

    // Reconstruct Spanish sentences from the word stream, then translate each to
    // English with Opus-MT — better than Whisper's translate task and timed to
    // the source sentences. (Sentence grouping uses punctuation + pauses.)
    self.postMessage({ type: 'status', status: 'translating' });
    const sentences = buildSentences(words).map((s) => ({
      text: s.text,
      start: s.start,
      end: s.end,
    }));
    const translation = await translateSentences(sentences);

    if (cancelRequested) {
      self.postMessage({ type: 'cancelled' });
      return;
    }

    self.postMessage({
      type: 'result',
      words,
      text: words.map((w) => w.text).join(' '),
      translation,
    });
  } catch (err: any) {
    self.postMessage({ type: 'error', message: err?.message ?? String(err) });
  }
});
