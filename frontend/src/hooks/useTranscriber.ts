import { useCallback, useEffect, useRef, useState } from 'react';
import { decodeAudioFile } from '../lib/audio';
import type { CaptionWord } from '../components/CaptionEditor';
import type { WhisperModel, WhisperTask } from '../lib/transcriber.worker';

export type TranscriberStatus =
  | 'idle'
  | 'decoding'
  | 'loading-model'
  | 'transcribing'
  | 'done'
  | 'error';

export interface ModelFileProgress {
  file: string;
  progress: number; // 0-100
}

interface RunOptions {
  model: WhisperModel;
  task: WhisperTask;
  language: string | null;
}

export function useTranscriber() {
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState<TranscriberStatus>('idle');
  const [modelFiles, setModelFiles] = useState<Record<string, ModelFileProgress>>({});
  const [captions, setCaptions] = useState<CaptionWord[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Lazily spin up the worker (module type so it can `import` Transformers.js).
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

  const run = useCallback(
    async (file: File, opts: RunOptions) => {
      setError(null);
      setCaptions([]);
      setModelFiles({});

      let samples: Float32Array;
      try {
        setStatus('decoding');
        const decoded = await decodeAudioFile(file);
        samples = decoded.samples;
      } catch (err: any) {
        setStatus('error');
        setError(`Could not decode audio: ${err?.message ?? err}. Try MP3, WAV, M4A, or OGG.`);
        return;
      }

      const worker = getWorker();

      const handle = (event: MessageEvent<any>) => {
        const msg = event.data;
        switch (msg.type) {
          case 'model-progress': {
            const p = msg.progress;
            // Transformers.js emits per-file download progress events.
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
          case 'result':
            setCaptions(msg.words as CaptionWord[]);
            setStatus('done');
            worker.removeEventListener('message', handle);
            break;
          case 'error':
            setError(msg.message);
            setStatus('error');
            worker.removeEventListener('message', handle);
            break;
        }
      };

      worker.addEventListener('message', handle);

      // Transfer the PCM buffer to avoid a copy.
      worker.postMessage(
        {
          type: 'run',
          audio: samples,
          model: opts.model,
          task: opts.task,
          language: opts.language,
        },
        [samples.buffer]
      );
    },
    [getWorker]
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setCaptions([]);
    setModelFiles({});
    setError(null);
  }, []);

  return { status, modelFiles, captions, error, run, reset, setCaptions };
}
