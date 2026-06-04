import { useEffect, useMemo, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  FileAudio,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Info,
  Cpu,
  Languages,
} from 'lucide-react';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useTranscriber } from './hooks/useTranscriber';
import { AudioCanvas } from './components/AudioCanvas';
import { CaptionEditor } from './components/CaptionEditor';
import { CaptionExport } from './components/CaptionExport';
import type { WhisperModel, WhisperTask } from './lib/transcriber.worker';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState<WhisperModel>('Xenova/whisper-base');
  const [task, setTask] = useState<WhisperTask>('transcribe');

  const { status, modelFiles, captions, error, run, reset, setCaptions } = useTranscriber();

  const {
    isPlaying,
    currentTime,
    duration,
    setSrc,
    pause,
    togglePlay,
    seek,
  } = useAudioPlayer();

  const isWorking = status === 'decoding' || status === 'loading-model' || status === 'transcribing';
  const done = status === 'done';

  // Wire the local file into the audio player for scrubbing once transcribed.
  useEffect(() => {
    if (done && file) {
      const url = URL.createObjectURL(file);
      setSrc(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [done, file, setSrc]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      reset();
    }
  };

  const handleReset = () => {
    setFile(null);
    reset();
    setSrc(null);
  };

  const handleStart = () => {
    if (!file) return;
    // Whisper's "translate" task always targets English; "transcribe" keeps the
    // source language. We hint Spanish for transcription and let translate auto-detect.
    const language = task === 'transcribe' ? 'spanish' : null;
    run(file, { model, task, language });
  };

  // Aggregate model-download progress into a single percentage.
  const modelProgress = useMemo(() => {
    const files = Object.values(modelFiles);
    if (files.length === 0) return 0;
    const total = files.reduce((sum, f) => sum + f.progress, 0);
    return Math.round(total / files.length);
  }, [modelFiles]);

  const statusLabel: Record<string, string> = {
    decoding: 'Decoding audio to 16 kHz mono…',
    'loading-model': modelProgress > 0 && modelProgress < 100
      ? `Downloading model (${modelProgress}%)…`
      : 'Loading model into memory…',
    transcribing: 'Running on-device Whisper inference…',
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTimeStr = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-slate-950 text-slate-100 p-3 md:p-6 overflow-hidden">
      {/* Header bar */}
      <header className="flex items-center justify-between pb-3 border-b border-slate-900">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-1.5 rounded-lg">
            <Volume2 className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm md:text-base font-extrabold tracking-wide uppercase bg-gradient-to-r from-indigo-400 to-pink-500 bg-clip-text text-transparent">
              Spanish Whisper Engine
            </h1>
            <p className="text-[10px] text-slate-500 font-medium">On-Device · No Server · Offline</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-full px-2.5 py-1 text-[9px] font-mono text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
          ON-DEVICE
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-grow flex flex-col gap-3.5 my-3 overflow-y-auto pr-0.5">

        {/* Upload + options panel */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
          {!file ? (
            <div className="relative border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-lg p-5 flex flex-col items-center justify-center text-center transition-colors">
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <FileAudio className="w-8 h-8 text-indigo-400 mb-2" />
              <span className="text-xs font-semibold text-slate-200">Choose Audio File</span>
              <span className="text-[10px] text-slate-500 mt-1">MP3, WAV, M4A, OGG</span>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="flex items-start justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <FileAudio className="w-7 h-7 text-indigo-400 shrink-0" />
                  <div className="overflow-hidden">
                    <p className="text-xs font-semibold truncate text-slate-200">{file.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{formatBytes(file.size)}</p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 transition-colors p-1"
                >
                  Remove
                </button>
              </div>

              {/* Engine options */}
              {!isWorking && !done && (
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wide text-slate-500 flex items-center gap-1">
                      <Cpu className="w-3 h-3" /> Model
                    </span>
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value as WhisperModel)}
                      className="bg-slate-950 text-slate-200 border border-slate-700 rounded px-2 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="Xenova/whisper-base">Base · accurate (~85 MB)</option>
                      <option value="Xenova/whisper-tiny">Tiny · fast (~45 MB)</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wide text-slate-500 flex items-center gap-1">
                      <Languages className="w-3 h-3" /> Output
                    </span>
                    <select
                      value={task}
                      onChange={(e) => setTask(e.target.value as WhisperTask)}
                      className="bg-slate-950 text-slate-200 border border-slate-700 rounded px-2 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="transcribe">Spanish transcript</option>
                      <option value="translate">English translation</option>
                    </select>
                  </label>
                </div>
              )}

              {/* Error surface */}
              {error && (
                <div className="bg-rose-950/60 border border-rose-800/60 rounded-lg p-2.5 flex items-start gap-2 text-[11px] text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Engine error</p>
                    <p className="text-[10px] text-rose-400/80 mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              {/* Start button */}
              {!isWorking && !done && (
                <button
                  onClick={handleStart}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-bold py-2 rounded-lg text-xs transition-all shadow-md shadow-indigo-600/20"
                >
                  {task === 'translate' ? 'Transcribe → Translate to English' : 'Transcribe Spanish Audio'}
                </button>
              )}

              {!isWorking && !done && (
                <p className="text-[10px] text-slate-500 text-center font-mono">
                  First run downloads the model once, then works fully offline.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Engine pipeline status */}
        {isWorking && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col items-center justify-center text-center py-8 space-y-4">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
            <div>
              <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">
                {status === 'transcribing' ? 'Inference' : status === 'decoding' ? 'Decoding' : 'Model'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 font-mono">{statusLabel[status]}</p>
            </div>

            {status === 'loading-model' && modelProgress > 0 && (
              <div className="w-full max-w-md bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-pink-500 h-full transition-all duration-300"
                  style={{ width: `${modelProgress}%` }}
                />
              </div>
            )}

            <p className="text-[10px] text-slate-500 font-mono">
              Everything runs locally — your audio never leaves this device.
            </p>
          </div>
        )}

        {/* Player + canvas + editor (after transcription) */}
        {done && (
          <>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
              <AudioCanvas
                duration={duration}
                currentTime={currentTime}
                isPlaying={isPlaying}
                onSeek={seek}
              />

              <div className="flex items-center justify-between">
                <div className="text-xs font-mono text-slate-400">
                  {formatTimeStr(currentTime)} / {formatTimeStr(duration)}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => seek(0)}
                    className="p-2 bg-slate-950 border border-slate-800 rounded-full hover:bg-slate-800 hover:text-white transition-colors active:scale-90"
                    title="Restart"
                  >
                    <RotateCcw className="w-4 h-4 text-slate-300" />
                  </button>
                  <button
                    onClick={togglePlay}
                    className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-500 hover:scale-105 active:scale-95 transition-all shadow-md shadow-indigo-600/35"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                </div>

                <div className="flex items-center gap-1 text-[10px] bg-indigo-950/40 text-indigo-400 border border-indigo-900/60 rounded px-2 py-0.5 font-mono">
                  <CheckCircle className="w-3.5 h-3.5" /> {task === 'translate' ? 'EN' : 'ES'}
                </div>
              </div>
            </div>

            <CaptionEditor
              captions={captions}
              currentTime={currentTime}
              onUpdateWord={(id, newText) => {
                setCaptions((prev) =>
                  prev.map((w) => (w.id === id ? { ...w, text: newText } : w))
                );
              }}
              onPause={pause}
              onSeek={seek}
            />

            <CaptionExport
              captions={captions}
              fileName={file ? file.name : 'spanish-captions'}
            />
          </>
        )}
      </main>

      {/* Info footer */}
      <footer className="text-[10px] text-slate-600 text-center py-1.5 border-t border-slate-900 mt-auto flex items-center justify-center gap-1 font-mono">
        <Info className="w-3 h-3 text-slate-500" /> On-Device Spanish Whisper &bull; Offline &bull; No Server
      </footer>
    </div>
  );
}
