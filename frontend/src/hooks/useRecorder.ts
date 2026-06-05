import { useCallback, useEffect, useRef, useState } from 'react';

type RecorderStatus = 'idle' | 'recording' | 'ready' | 'error';

export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const stopMeters = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animationRef.current !== null) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    audioContextRef.current?.close();
    audioContextRef.current = null;
    setLevel(0);
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clear = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
    }
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    recorderRef.current = null;
    stopMeters();
    stopStream();
    setFile(null);
    setElapsedMs(0);
    setLevel(0);
    setError(null);
    setStatus('idle');
  }, [stopMeters, stopStream]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    stopMeters();
  }, [stopMeters]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Recording is not available in this browser.');
      setStatus('error');
      return;
    }

    try {
      clear();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined;
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const recordedFile = new File([blob], `recording-${new Date().toISOString()}.webm`, {
          type: blob.type,
        });
        setFile(recordedFile);
        setStatus('ready');
        stopStream();
        recorderRef.current = null;
      };

      const AudioCtx: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioCtx();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioContextRef.current = audioContext;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tickLevel = () => {
        analyser.getByteFrequencyData(data);
        const average = data.reduce((sum, value) => sum + value, 0) / data.length;
        setLevel(Math.min(1, average / 128));
        animationRef.current = window.requestAnimationFrame(tickLevel);
      };

      recorder.start();
      startedAtRef.current = Date.now();
      timerRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 250);
      tickLevel();
      setStatus('recording');
    } catch (err: any) {
      stopMeters();
      stopStream();
      setError(`Microphone access did not start. (${err?.message ?? err})`);
      setStatus('error');
    }
  }, [clear, stopMeters, stopStream]);

  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
      }
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
      recorderRef.current = null;
      stopMeters();
      stopStream();
    };
  }, [stopMeters, stopStream]);

  return { status, file, elapsedMs, level, error, start, stop, clear };
}
