import { useCallback, useEffect, useRef, useState } from 'react';
import { decodeAudioFile } from '../lib/audio';
import { EtaEstimator } from '../lib/eta';
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
}

export function useTranscriber() {
  const workerRef = useRef<Worker | null>(null);
  const etaRef = useRef<EtaEstimator | null>(null);
  const handlerRef = useRef<((e: MessageEvent<any>) => void) | null>(null);

  const [status, setStatus] = useState<TranscriberStatus>('idle');
  const [modelFiles, setModelFiles] = useState<Record<string, ModelFileProgress>>({});
  const [captions, setCaptions] = useState<CaptionWord[]>([]);
  const [translation, setTranslation] = useState<Translation | null>(null);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const run = useCallback(
    async (file: File, opts: RunOptions) => {
      setError(null);
      setCaptions([]);
      setTranslation(null);
      setModelFiles({});
      setProgress(null);
      etaRef.current = null;

      let samples: Float32Array;
      try {
        setStatus('decoding');
        const decoded = await decodeAudioFile(file);
        samples = decoded.samples;
      } catch (err: any) {
        setStatus('error');
        setError(`That file wouldn't open — try an MP3, WAV, M4A, or OGG. (${err?.message ?? err})`);
        return;
      }

      const worker = getWorker();
      detach();

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
          case 'result':
            setCaptions(msg.words as CaptionWord[]);
            setTranslation((msg.translation as Translation) ?? null);
            setProgress({ fraction: 1, etaMs: 0, elapsedMs: etaRef.current?.elapsedMs() ?? 0 });
            setStatus('done');
            detach();
            break;
          case 'cancelled':
            setStatus('idle');
            setProgress(null);
            detach();
            break;
          case 'error':
            setError(msg.message);
            setStatus('error');
            detach();
            break;
        }
      };

      handlerRef.current = handle;
      worker.addEventListener('message', handle);

      // Transfer the PCM buffer to avoid a copy (re-runs re-decode from the file).
      worker.postMessage(
        {
          type: 'run',
          audio: samples,
          model: opts.model,
          language: opts.language ?? 'spanish',
          prompt: opts.prompt,
        },
        [samples.buffer]
      );
    },
    [getWorker, detach]
  );

  const cancel = useCallback(() => {
    workerRef.current?.postMessage({ type: 'cancel' });
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

  return { status, modelFiles, captions, translation, progress, error, run, cancel, reset, setCaptions };
}
