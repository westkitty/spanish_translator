import { useEffect, useMemo, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  FileAudio,
  CheckCircle,
  AlertTriangle,
  Info,
  Cpu,
  Languages,
  HelpCircle,
  Library,
} from 'lucide-react';
import { useRef } from 'react';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useTranscriber } from './hooks/useTranscriber';
import { useProjects } from './hooks/useProjects';
import { AudioCanvas } from './components/AudioCanvas';
import { CaptionEditor } from './components/CaptionEditor';
import { CaptionExport } from './components/CaptionExport';
import { TranslationPanel } from './components/TranslationPanel';
import { WelcomeScreen } from './components/WelcomeScreen';
import { FaqModal } from './components/FaqModal';
import { ProgressPanel } from './components/ProgressPanel';
import { LibraryModal } from './components/LibraryModal';
import { AdvancedOptions } from './components/AdvancedOptions';
import { newProjectId, type StoredProject } from './lib/db';
import type { WhisperModel } from './lib/transcriber.worker';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState<WhisperModel>('Xenova/whisper-base');
  const [vocab, setVocab] = useState('');
  const [highAccuracy, setHighAccuracy] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showFaq, setShowFaq] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  const { status, modelFiles, captions, translation, progress, error, run, cancel, loadResult, reset, setCaptions } =
    useTranscriber();

  const { projects, save, open, remove } = useProjects();

  // Base record for the active project (audio + identity); words/translation are
  // merged in on autosave. Null until a run completes or a project is opened.
  const projectBaseRef = useRef<Omit<StoredProject, 'words' | 'translation' | 'updatedAt'> | null>(null);
  const pendingSaveRef = useRef(false);

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
      projectBaseRef.current = null;
      reset();
    }
  };

  const handleReset = () => {
    setFile(null);
    projectBaseRef.current = null;
    reset();
    setSrc(null);
  };

  const handleStart = () => {
    if (!file) return;
    pendingSaveRef.current = true;
    // Always produces both: a Spanish transcript and an English translation.
    run(file, { model, language: 'spanish', prompt: vocab.trim() || undefined, highAccuracy });
  };

  // Save a freshly-completed run as a new project (once), then autosave edits.
  useEffect(() => {
    if (!done || !pendingSaveRef.current || !file || captions.length === 0) return;
    pendingSaveRef.current = false;
    const durationSec = Math.max(
      0,
      ...captions.map((w) => w.end),
      ...(translation?.segments.map((s) => s.end) ?? [0])
    );
    const base = {
      id: newProjectId(),
      name: file.name.replace(/\.[^/.]+$/, ''),
      createdAt: Date.now(),
      model,
      durationSec,
      audioBlob: file as Blob,
    };
    projectBaseRef.current = base;
    save({ ...base, words: captions, translation, updatedAt: Date.now() });
  }, [done, file, captions, translation, model, save]);

  // Autosave edits to the active project (debounced).
  useEffect(() => {
    const base = projectBaseRef.current;
    if (!done || !base) return;
    const t = window.setTimeout(() => {
      save({ ...base, words: captions, translation, updatedAt: Date.now() });
    }, 800);
    return () => window.clearTimeout(t);
  }, [captions, translation, done, save]);

  const handleOpenProject = async (id: string) => {
    const p = await open(id);
    if (!p) return;
    const restored = new File([p.audioBlob], `${p.name}.audio`, {
      type: p.audioBlob.type || 'audio/*',
    });
    setFile(restored);
    projectBaseRef.current = {
      id: p.id,
      name: p.name,
      createdAt: p.createdAt,
      model: p.model,
      durationSec: p.durationSec,
      audioBlob: p.audioBlob,
    };
    pendingSaveRef.current = false;
    loadResult(p.words, p.translation);
    setShowLibrary(false);
  };

  // Aggregate model-download progress into a single percentage.
  const modelProgress = useMemo(() => {
    const files = Object.values(modelFiles);
    if (files.length === 0) return 0;
    const total = files.reduce((sum, f) => sum + f.progress, 0);
    return Math.round(total / files.length);
  }, [modelFiles]);

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

      {/* Saved transcripts library */}
      <LibraryModal
        open={showLibrary}
        onClose={() => setShowLibrary(false)}
        projects={projects}
        onOpenProject={handleOpenProject}
        onDeleteProject={remove}
      />

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
          <button
            onClick={() => setShowLibrary(true)}
            aria-label="Open saved transcripts"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Library className="w-5 h-5" />
          </button>
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
                  <AdvancedOptions
                    vocab={vocab}
                    onVocabChange={setVocab}
                    highAccuracy={highAccuracy}
                    onHighAccuracyChange={setHighAccuracy}
                  />
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
          <ProgressPanel
            status={status}
            modelProgress={modelProgress}
            progress={progress}
            onCancel={cancel}
          />
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
