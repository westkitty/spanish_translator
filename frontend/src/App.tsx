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
  HelpCircle,
} from 'lucide-react';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useTranscriber } from './hooks/useTranscriber';
import { AudioCanvas } from './components/AudioCanvas';
import { CaptionEditor } from './components/CaptionEditor';
import { CaptionExport } from './components/CaptionExport';
import { TranslationPanel } from './components/TranslationPanel';
import { WelcomeScreen } from './components/WelcomeScreen';
import { FaqModal } from './components/FaqModal';
import type { WhisperModel } from './lib/transcriber.worker';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState<WhisperModel>('Xenova/whisper-base');
  const [showWelcome, setShowWelcome] = useState(true);
  const [showFaq, setShowFaq] = useState(false);

  const { status, modelFiles, captions, translation, error, run, reset, setCaptions } = useTranscriber();

  const {
    isPlaying,
    currentTime,
    duration,
    setSrc,
    pause,
    togglePlay,
    seek,
  } = useAudioPlayer();

  const isWorking =
    status === 'decoding' ||
    status === 'loading-model' ||
    status === 'transcribing' ||
    status === 'translating';
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
    // Always produces both: a Spanish transcript and an English translation.
    run(file, { model, language: 'spanish' });
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
    transcribing: 'Transcribing Spanish (1/2)…',
    translating: 'Translating to English (2/2)…',
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
    <div className="relative flex flex-col h-screen max-h-screen text-slate-100 p-3 md:p-6 overflow-hidden">
      {/* Ambient Azure glow background */}
      <div className="app-bg" aria-hidden="true" />

      {/* Welcome gate */}
      {showWelcome && <WelcomeScreen onStart={() => setShowWelcome(false)} />}

      {/* FAQ */}
      <FaqModal open={showFaq} onClose={() => setShowFaq(false)} />

      {/* Header bar */}
      <header className="relative z-10 glass rounded-2xl px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-gradient-to-br from-sky-400 to-blue-600 p-1.5 rounded-xl glow-azure">
            <Volume2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm md:text-base font-extrabold tracking-tight bg-gradient-to-r from-sky-300 to-blue-400 bg-clip-text text-transparent">
              Spanish Whisper Engine
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">On-Device · No Server · Offline</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-sky-500/10 border border-sky-400/20 rounded-full px-2.5 py-1 text-[9px] font-mono text-sky-300">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping"></span>
            ON-DEVICE
          </div>
          <button
            onClick={() => setShowFaq(true)}
            aria-label="Open FAQ"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="relative z-10 flex-grow flex flex-col gap-3.5 my-3 overflow-y-auto pr-0.5">

        {/* Upload + options panel */}
        <section className="glass rounded-2xl p-4">
          {!file ? (
            <div className="relative border-2 border-dashed border-white/10 hover:border-sky-400/50 rounded-xl p-5 flex flex-col items-center justify-center text-center transition-colors">
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <FileAudio className="w-8 h-8 text-sky-300 mb-2" />
              <span className="text-xs font-semibold text-slate-100">Choose Audio File</span>
              <span className="text-[10px] text-slate-400 mt-1">MP3, WAV, M4A, OGG</span>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="flex items-start justify-between bg-white/[0.03] p-2.5 rounded-xl border border-white/10">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <FileAudio className="w-7 h-7 text-sky-300 shrink-0" />
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
                <div className="space-y-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wide text-slate-500 flex items-center gap-1">
                      <Cpu className="w-3 h-3" /> Model
                    </span>
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value as WhisperModel)}
                      className="bg-white/[0.04] text-slate-100 border border-white/10 rounded-lg px-2 py-1.5 text-xs focus:border-sky-400 focus:outline-none"
                    >
                      <option value="Xenova/whisper-base">Base · accurate (~85 MB)</option>
                      <option value="Xenova/whisper-tiny">Tiny · fast (~45 MB)</option>
                    </select>
                  </label>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                    <Languages className="w-3 h-3 text-sky-300" />
                    Outputs a Spanish transcript <span className="text-slate-600">+</span> English translation automatically.
                  </p>
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
                  className="w-full bg-gradient-to-r from-sky-400 to-blue-600 hover:from-sky-300 hover:to-blue-500 active:scale-[0.98] text-white font-bold py-2.5 rounded-xl text-xs transition-all glow-azure cursor-pointer"
                >
                  Transcribe &amp; Translate
                </button>
              )}

              {!isWorking && !done && (
                <p className="text-[10px] text-slate-400 text-center font-mono">
                  First run downloads the model once, then works fully offline.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Engine pipeline status */}
        {isWorking && (
          <div className="glass rounded-2xl p-5 flex flex-col items-center justify-center text-center py-8 space-y-4">
            <RefreshCw className="w-8 h-8 text-sky-300 animate-spin" />
            <div>
              <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wide">
                {status === 'transcribing'
                  ? 'Transcribing'
                  : status === 'translating'
                  ? 'Translating'
                  : status === 'decoding'
                  ? 'Decoding'
                  : 'Model'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 font-mono">{statusLabel[status]}</p>
            </div>

            {status === 'loading-model' && modelProgress > 0 && (
              <div className="w-full max-w-md bg-white/[0.04] rounded-full h-2 overflow-hidden border border-white/10">
                <div
                  className="bg-gradient-to-r from-sky-400 to-blue-500 h-full transition-all duration-300"
                  style={{ width: `${modelProgress}%` }}
                />
              </div>
            )}

            <p className="text-[10px] text-slate-400 font-mono">
              Everything runs locally — your audio never leaves this device.
            </p>
          </div>
        )}

        {/* Player + canvas + editor (after transcription) */}
        {done && (
          <>
            <div className="glass rounded-2xl p-4 space-y-3">
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
                    className="p-2 bg-white/[0.04] border border-white/10 rounded-full hover:bg-white/10 hover:text-white transition-colors active:scale-90 cursor-pointer"
                    title="Restart"
                  >
                    <RotateCcw className="w-4 h-4 text-slate-300" />
                  </button>
                  <button
                    onClick={togglePlay}
                    className="p-3 bg-gradient-to-br from-sky-400 to-blue-600 text-white rounded-full hover:scale-105 active:scale-95 transition-all glow-azure cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                </div>

                <div className="flex items-center gap-1 text-[10px] bg-sky-500/10 text-sky-300 border border-sky-400/20 rounded-full px-2 py-0.5 font-mono">
                  <CheckCircle className="w-3.5 h-3.5" /> ES + EN
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

            <TranslationPanel
              translation={translation}
              currentTime={currentTime}
              onSeek={seek}
            />

            <CaptionExport
              captions={captions}
              translation={translation}
              fileName={file ? file.name : 'spanish-captions'}
            />
          </>
        )}
      </main>

      {/* Info footer */}
      <footer className="relative z-10 text-[10px] text-slate-500 text-center py-1.5 mt-auto flex items-center justify-center gap-1 font-mono">
        <Info className="w-3 h-3 text-slate-500" /> On-Device Spanish Whisper &bull; Offline &bull; No Server
      </footer>
    </div>
  );
}
