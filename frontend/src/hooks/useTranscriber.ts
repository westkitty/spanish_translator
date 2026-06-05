import { useCallback, useEffect, useRef, useState } from 'react';
import { decodeAudioFile } from '../lib/audio';
import { EtaEstimator } from '../lib/eta';
import { replaceTimedRange, type TimedRange } from '../lib/timeline';
import type { CaptionWord } from '../components/CaptionEditor';
import type { WhisperModel } from '../lib/transcriber.worker';

export type TranscriberStatus =
  | 'idle'
  | 'decoding'
  | 'loading-model'
  | 'transcribing'
  | 'translating'
  | 'done'
  | 'error';

export interface ModelFileProgress {
  file: string;
  progress: number; // 0-100
}

export interface TranslationSegment {
  id: string;
  text: string;
  start: number;
  end: number;
}

export interface Translation {
  segments: TranslationSegment[];
  text: string;
}

export interface RunProgress {
  fraction: number; // 0..1 of inference work done
  etaMs: number | null; // estimated remaining, device-calibrated
  elapsedMs: number;
}

export interface RunOptions {
  model: WhisperModel;
  language?: string;
  prompt?: string;
  highAccuracy?: boolean;
}

interface CachedAudio {
  file: File;
  samples: Float32Array;
}

type RunMode =
  | { kind: 'full' }
  | { kind: 'region'; range: TimedRange };

export function useTranscriber() {
  const workerRef = useRef<Worker | null>(null);
  const etaRef = useRef<EtaEstimator | null>(null);
  const handlerRef = useRef<((e: MessageEvent<any>) => void) | null>(null);
  const cachedAudioRef = useRef<CachedAudio | null>(null);
  const captionsRef = useRef<CaptionWord[]>([]);
  const translationRef = useRef<Translation | null>(null);
  const activeModeRef = useRef<RunMode>({ kind: 'full' });

  const [status, setStatus] = useState<TranscriberStatus>('idle');
  const [modelFiles, setModelFiles] = useState<Record<string, ModelFileProgress>>({});
  const [captions, setCaptions] = useState<CaptionWord[]>([]);
  const [translation, setTranslation] = useState<Translation | null>(null);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    captionsRef.current = captions;
  }, [captions]);

  useEffect(() => {
    translationRef.current = translation;
  }, [translation]);

  const getWorker = useCallback((): Worker => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../lib/transcriber.worker.ts', import.meta.url),
        { type: 'module' }
      );
    }
    return workerRef.current;
  }, []);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const detach = useCallback(() => {
    if (workerRef.current && handlerRef.current) {
      workerRef.current.removeEventListener('message', handlerRef.current);
    }
    handlerRef.current = null;
  }, []);

  const decodeForRun = useCallback(async (file: File): Promise<Float32Array> => {
    const cached = cachedAudioRef.current;

    if (cached?.file === file) {
      return cached.samples;
    }

    setStatus('decoding');
    const decoded = await decodeAudioFile(file);
    const samples = decoded.samples.slice();
    cachedAudioRef.current = { file, samples };
    return samples;
  }, []);

  const postRun = useCallback(
    (samples: Float32Array, opts: RunOptions, mode: RunMode, offsetSec: number) => {
      const worker = getWorker();
      detach();
      activeModeRef.current = mode;

      const handle = (event: MessageEvent<any>) => {
        const msg = event.data;
        switch (msg.type) {
          case 'model-progress': {
            const p = msg.progress;
            if (p?.file && (p.status === 'progress' || p.status === 'download' || p.status === 'done')) {
              setModelFiles((prev) => ({
                ...prev,
                [p.file]: {
                  file: p.file,
                  progress: p.status === 'done' ? 100 : Math.round(p.progress ?? 0),
                },
              }));
            }
            break;
          }
          case 'status':
            setStatus(msg.status);
            break;
          case 'plan':
            etaRef.current = new EtaEstimator(msg.windowCount * msg.passes);
            setProgress({ fraction: 0, etaMs: null, elapsedMs: 0 });
            break;
          case 'window': {
            const eta = etaRef.current;
            if (eta) {
              eta.record(msg.wallMs);
              setProgress({
                fraction: eta.fraction(),
                etaMs: eta.remainingMs(),
                elapsedMs: eta.elapsedMs(),
              });
            }
            break;
          }
          case 'result': {
            const words = msg.words as CaptionWord[];
            const nextTranslation = (msg.translation as Translation) ?? null;

            if (activeModeRef.current.kind === 'region') {
              const range = activeModeRef.current.range;
              const mergedWords = replaceTimedRange(captionsRef.current, words, range, 'word');
              const currentTranslation = translationRef.current;
              const mergedSegments = replaceTimedRange(
                currentTranslation?.segments ?? [],
                nextTranslation?.segments ?? [],
                range,
                'seg'
              );
              setCaptions(mergedWords);
              setTranslation(
                currentTranslation || nextTranslation
                  ? {
                      segments: mergedSegments,
                      text: mergedSegments.map((segment) => segment.text).join(' '),
                    }
                  : null
              );
            } else {
              setCaptions(words);
              setTranslation(nextTranslation);
            }

            setProgress({ fraction: 1, etaMs: 0, elapsedMs: etaRef.current?.elapsedMs() ?? 0 });
            setStatus('done');
            detach();
            break;
          }
          case 'cancelled':
            setStatus(activeModeRef.current.kind === 'region' ? 'done' : 'idle');
            setProgress(null);
            detach();
            break;
          case 'error':
            setError(msg.message);
            setStatus(activeModeRef.current.kind === 'region' ? 'done' : 'error');
            detach();
            break;
        }
      };

      handlerRef.current = handle;
      worker.addEventListener('message', handle);

      worker.postMessage(
        {
          type: 'run',
          audio: samples,
          model: opts.model,
          language: opts.language ?? 'spanish',
          prompt: opts.prompt,
          highAccuracy: opts.highAccuracy,
          offsetSec,
        },
        [samples.buffer]
      );
    },
    [detach, getWorker]
  );

  const run = useCallback(
    async (file: File, opts: RunOptions) => {
      setError(null);
      setCaptions([]);
      setTranslation(null);
      setModelFiles({});
      setProgress(null);
      etaRef.current = null;

      try {
        const samples = await decodeForRun(file);
        postRun(samples.slice(), opts, { kind: 'full' }, 0);
      } catch (err: any) {
        setStatus('error');
        setError(`That file wouldn't open — try an MP3, WAV, M4A, or OGG. (${err?.message ?? err})`);
      }
    },
    [decodeForRun, postRun]
  );

  const runRegion = useCallback(
    async (file: File, range: TimedRange, opts: RunOptions) => {
      setError(null);
      setModelFiles({});
      setProgress(null);
      etaRef.current = null;

      try {
        const samples = await decodeForRun(file);
        const startSec = Math.max(0, Math.min(range.start, range.end));
        const endSec = Math.max(startSec, Math.max(range.start, range.end));
        const startSample = Math.floor(startSec * 16000);
        const endSample = Math.min(samples.length, Math.ceil(endSec * 16000));

        if (endSample <= startSample) {
          setError('Select a longer region before re-running it.');
          setStatus('done');
          return;
        }

        postRun(samples.slice(startSample, endSample), opts, { kind: 'region', range: { start: startSec, end: endSec } }, startSec);
      } catch (err: any) {
        setStatus('done');
        setError(`That region couldn't be prepared. (${err?.message ?? err})`);
      }
    },
    [decodeForRun, postRun]
  );

  const cancel = useCallback(() => {
    workerRef.current?.postMessage({ type: 'cancel' });
  }, []);

  // Load a previously-saved result straight into the "done" view.
  const loadResult = useCallback((words: CaptionWord[], trans: Translation | null) => {
    setCaptions(words);
    setTranslation(trans);
    setProgress(null);
    setError(null);
    setStatus('done');
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setCaptions([]);
    setTranslation(null);
    setModelFiles({});
    setProgress(null);
    setError(null);
    etaRef.current = null;
  }, []);

  const clearDecodedAudio = useCallback(() => {
    cachedAudioRef.current = null;
  }, []);

  return {
    status,
    modelFiles,
    captions,
    translation,
    progress,
    error,
    run,
    runRegion,
    cancel,
    loadResult,
    reset,
    clearDecodedAudio,
    setCaptions,
  };
}
