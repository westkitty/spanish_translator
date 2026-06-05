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
  Mic,
  Square,
} from 'lucide-react';
import { useRef } from 'react';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useTranscriber } from './hooks/useTranscriber';
import { useProjects } from './hooks/useProjects';
import { useRecorder } from './hooks/useRecorder';
import { AudioCanvas } from './components/AudioCanvas';
import { TranscriptView } from './components/TranscriptView';
import type { CaptionWord } from './components/CaptionEditor';
import { CaptionExport } from './components/CaptionExport';
import { TranslationPanel } from './components/TranslationPanel';
import { WelcomeScreen } from './components/WelcomeScreen';
import { FaqModal } from './components/FaqModal';
import { ProgressPanel } from './components/ProgressPanel';
import { LibraryModal } from './components/LibraryModal';
import { AdvancedOptions } from './components/AdvancedOptions';
import type { Sentence } from './lib/punctuation';
import { newProjectId, type StoredProject } from './lib/db';
import { decodeAudioFile, extractWavClip } from './lib/audio';
import { deriveGlossaryRules, mergeGlossaryText } from './lib/glossary';
import { findSilences, type SilenceRange } from './lib/vad';
import { saveBlobFile, saveTextFile } from './lib/fileSave';
import { getStoredFlag, setStoredFlag } from './lib/storage';
import { availableTiers, defaultModel, detectWebGPU, type WhisperModel } from './lib/models';

const WELCOME_SEEN_KEY = 'spanish-whisper-seen-welcome';
const RESULT_TIP_SEEN_KEY = 'spanish-whisper-seen-result-tip';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [hasWebGPU] = useState(detectWebGPU);
  const tiers = useMemo(() => availableTiers(hasWebGPU), [hasWebGPU]);
  const [model, setModel] = useState<WhisperModel>(() => defaultModel(detectWebGPU()));
  const [vocab, setVocab] = useState('');
  const [highAccuracy, setHighAccuracy] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => !getStoredFlag(WELCOME_SEEN_KEY));
  const [showResultTip, setShowResultTip] = useState(() => !getStoredFlag(RESULT_TIP_SEEN_KEY));
  const [showFaq, setShowFaq] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [selectRegionMode, setSelectRegionMode] = useState(false);
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const [inputMode, setInputMode] = useState<'file' | 'record'>('file');
  const [silences, setSilences] = useState<SilenceRange[]>([]);
  const [learnedMsg, setLearnedMsg] = useState<string | null>(null);

  const {
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
  } = useTranscriber();

  const { projects, save, open, remove } = useProjects();
  const recorder = useRecorder();

  // Edit history for undo/redo + revert-to-original.
  const [undoStack, setUndoStack] = useState<CaptionWord[][]>([]);
  const [redoStack, setRedoStack] = useState<CaptionWord[][]>([]);
  const originalRef = useRef<CaptionWord[] | null>(null);

  const editCaptions = (next: CaptionWord[]) => {
    setUndoStack((s) => [...s, captions]);
    setRedoStack([]);
    setCaptions(next);
  };
  const handleUndo = () => {
    setUndoStack((s) => {
      if (s.length === 0) return s;
      setRedoStack((r) => [captions, ...r]);
      setCaptions(s[s.length - 1]);
      return s.slice(0, -1);
    });
  };
  const handleRedo = () => {
    setRedoStack((r) => {
      if (r.length === 0) return r;
      setUndoStack((s) => [...s, captions]);
      setCaptions(r[0]);
      return r.slice(1);
    });
  };
  const handleRevert = () => {
    if (originalRef.current) editCaptions(originalRef.current);
  };
  // Correction feedback loop: turn the edits the user made to this transcript
  // into glossary rules so the same fixes auto-apply on future runs.
  const handleTeachCorrections = () => {
    const learned = deriveGlossaryRules(originalRef.current ?? [], captions);
    if (learned.length === 0) {
      setLearnedMsg('No new corrections to remember yet.');
      return;
    }
    setVocab((v) => mergeGlossaryText(v, learned));
    setLearnedMsg(
      `Remembered ${learned.length} correction${learned.length === 1 ? '' : 's'} for next time.`
    );
  };
  const replaceAll = (find: string, replace: string): number => {
    const re = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let count = 0;
    const next = captions.map((w) => {
      const matches = w.text.match(re);
      if (matches) {
        count += matches.length;
        return { ...w, text: w.text.replace(re, replace) };
      }
      return w;
    });
    if (count > 0) editCaptions(next);
    return count;
  };
  const resetHistory = () => {
    setUndoStack([]);
    setRedoStack([]);
    originalRef.current = null;
  };

  // Base record for the active project (audio + identity); words/translation are
  // merged in on autosave. Null until a run completes or a project is opened.
  const projectBaseRef = useRef<Omit<StoredProject, 'words' | 'translation' | 'updatedAt'> | null>(null);
  const pendingSaveRef = useRef(false);

  const {
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    loopRange,
    setSrc,
    setPlaybackRate,
    setLoopRange,
    clearLoopRange,
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

  useEffect(() => {
    if (!recorder.file) return;

    setFile(recorder.file);
    projectBaseRef.current = null;
    setSelectedRange(null);
    setSelectRegionMode(false);
    resetHistory();
    clearDecodedAudio();
    reset();
  }, [clearDecodedAudio, recorder.file, reset]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      projectBaseRef.current = null;
      setSelectedRange(null);
      setSelectRegionMode(false);
      setSilences([]);
      resetHistory();
      clearDecodedAudio();
      reset();
    }
  };

  const handleReset = () => {
    setFile(null);
    projectBaseRef.current = null;
    setSelectedRange(null);
    setSelectRegionMode(false);
    setSilences([]);
    resetHistory();
    reset();
    clearDecodedAudio();
    recorder.clear();
    setSrc(null);
  };

  const handleStart = () => {
    if (!file) return;
    setSelectedRange(null);
    setSelectRegionMode(false);
    setSilences([]);
    pendingSaveRef.current = true;
    // Always produces both: a Spanish transcript and an English translation.
    run(file, { model, language: 'spanish', glossary: vocab.trim() || undefined, highAccuracy });
  };

  const handleDismissWelcome = () => {
    setStoredFlag(WELCOME_SEEN_KEY);
    setShowWelcome(false);
  };

  const handleShowWelcomeAgain = () => {
    setShowFaq(false);
    setShowWelcome(true);
  };

  const handleDismissResultTip = () => {
    setStoredFlag(RESULT_TIP_SEEN_KEY);
    setShowResultTip(false);
  };

  const runOptions = {
    model,
    language: 'spanish',
    glossary: vocab.trim() || undefined,
    highAccuracy,
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
    originalRef.current = captions;
    setUndoStack([]);
    setRedoStack([]);
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

  // Re-run the same file with (possibly) different settings — returns to the
  // options screen, keeping the file loaded. Existing edits will be replaced.
  const handleRerun = () => {
    const confirmed = window.confirm(
      'Re-run this file? The current transcript, translation, and edits will be replaced.'
    );
    if (!confirmed) return;

    pause();
    seek(0);
    setSelectedRange(null);
    setSelectRegionMode(false);
    setSilences([]);
    projectBaseRef.current = null;
    pendingSaveRef.current = false;
    resetHistory();
    reset();
  };

  const handleRegionRerun = () => {
    if (!file || !selectedRange) return;

    const confirmed = window.confirm(
      'Re-run just this selected region? Words and translation in that range will be replaced.'
    );
    if (!confirmed) return;

    setUndoStack((s) => [...s, captions]);
    setRedoStack([]);
    runRegion(file, selectedRange, runOptions);
  };

  const handleExportClip = async (sentence: Sentence) => {
    if (!file) return;

    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const clipName = `${baseName}-${Math.round(sentence.start)}-${Math.round(sentence.end)}`;
    const wav = await extractWavClip(file, sentence.start, sentence.end);
    await saveBlobFile(`${clipName}.wav`, wav);
    await saveTextFile(`${clipName}.txt`, 'text/plain;charset=utf-8', `${sentence.text}\n`);
  };

  const handleSetLoopStart = () => {
    setLoopRange({ start: currentTime, end: loopRange?.end ?? Math.min(duration, currentTime + 5) });
  };

  const handleSetLoopEnd = () => {
    setLoopRange({ start: loopRange?.start ?? Math.max(0, currentTime - 5), end: currentTime });
  };

  const handleOpenProject = async (id: string) => {
    const p = await open(id);
    if (!p) return;
    
    pause();
    setSrc(null);
    
    const restored = new File([p.audioBlob], `${p.name}.audio`, {
      type: p.audioBlob.type || 'audio/*',
    });
    
    projectBaseRef.current = {
      id: p.id,
      name: p.name,
      createdAt: p.createdAt,
      model: p.model,
      durationSec: p.durationSec,
      audioBlob: p.audioBlob,
    };
    
    pendingSaveRef.current = false;
    originalRef.current = p.words;
    
    setFile(restored);
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

  const formatRange = (range: { start: number; end: number }) =>
    `${formatTimeStr(Math.min(range.start, range.end))} - ${formatTimeStr(Math.max(range.start, range.end))}`;

  useEffect(() => {
    if (!done || !file) {
      setSilences([]);
      return;
    }

    let cancelled = false;
    decodeAudioFile(file)
      .then((decoded) => {
        if (cancelled) return;
        setSilences(findSilences(decoded.samples, 16000, { thresholdDb: -45, minSilenceSec: 0.5 }));
      })
      .catch(() => {
        if (!cancelled) {
          setSilences([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [done, file]);

  const formatElapsedMs = (ms: number) => {
    const seconds = Math.round(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!done || isEditableTarget(event.target)) return;

      if (event.key === ' ') {
        event.preventDefault();
        togglePlay();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        seek(currentTime - 5);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        seek(currentTime + 5);
      } else if (event.key === 'Tab') {
        const nextWord = captions.find((word) => word.start > currentTime + 0.05);
        if (nextWord) {
          event.preventDefault();
          seek(nextWord.start);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [captions, currentTime, done, seek, togglePlay]);

  return (
    <div className="relative flex flex-col h-screen max-h-screen text-slate-100 p-3 md:p-6 overflow-hidden">
      {/* Ambient Azure glow background */}
      <div className="app-bg" aria-hidden="true" />

      {/* Welcome gate */}
      {showWelcome && <WelcomeScreen onStart={handleDismissWelcome} />}

      {/* FAQ */}
      <FaqModal open={showFaq} onClose={() => setShowFaq(false)} onShowWelcome={handleShowWelcomeAgain} />

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
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-1 bg-white/[0.03] rounded-xl p-1">
                <button
                  onClick={() => setInputMode('file')}
                  className={`rounded-lg py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                    inputMode === 'file' ? 'bg-sky-500/20 text-sky-100' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Choose file
                </button>
                <button
                  onClick={() => setInputMode('record')}
                  className={`rounded-lg py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                    inputMode === 'record' ? 'bg-sky-500/20 text-sky-100' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Record
                </button>
              </div>

              {inputMode === 'file' ? (
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
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center space-y-4">
                  <div className="mx-auto w-14 h-14 rounded-full bg-sky-500/15 border border-sky-400/20 flex items-center justify-center">
                    <Mic className="w-7 h-7 text-sky-200" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-100">
                      {recorder.status === 'recording' ? 'Recording...' : 'Record from microphone'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {recorder.status === 'recording'
                        ? formatElapsedMs(recorder.elapsedMs)
                        : 'When you stop, the recording loads like any other audio file.'}
                    </p>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all"
                      style={{ width: `${Math.round(recorder.level * 100)}%` }}
                    />
                  </div>
                  {recorder.error && <p className="text-[10px] text-rose-300">{recorder.error}</p>}
                  {recorder.status === 'recording' ? (
                    <button
                      onClick={recorder.stop}
                      className="inline-flex items-center gap-2 rounded-xl bg-rose-500/15 border border-rose-300/30 text-rose-100 px-4 py-2 text-xs font-semibold hover:bg-rose-500/20 transition-colors cursor-pointer"
                    >
                      <Square className="w-4 h-4" /> Stop recording
                    </button>
                  ) : (
                    <button
                      onClick={recorder.start}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 to-blue-600 text-white px-4 py-2 text-xs font-bold hover:from-sky-300 hover:to-blue-500 transition-colors cursor-pointer"
                    >
                      <Mic className="w-4 h-4" /> Start recording
                    </button>
                  )}
                </div>
              )}
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
                      {tiers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                          {t.recommended ? ' · recommended' : ''}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-500">
                      {tiers.find((t) => t.id === model)?.blurb}
                    </span>
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

              {done && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 space-y-2">
                  <p className="text-[11px] text-amber-100">
                    Re-run keeps this file selected so you can change the model or options. It will replace the current transcript, translation, and edits.
                  </p>
                  <button
                    onClick={handleRerun}
                    className="w-full bg-white/[0.04] border border-amber-300/30 hover:bg-amber-400/10 text-amber-100 font-semibold py-2 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Re-run with new settings
                  </button>
                </div>
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
            {showResultTip && (
              <div className="glass rounded-2xl p-3 flex items-start gap-3 border border-sky-400/20">
                <Info className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
                <div className="flex-grow">
                  <p className="text-xs font-semibold text-slate-100">Your transcript is ready.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Tap any Spanish word to fix it, or open Read view for sentence-style editing and clip export.
                  </p>
                </div>
                <button
                  onClick={handleDismissResultTip}
                  className="text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="glass rounded-2xl p-4 space-y-3">
              <AudioCanvas
                duration={duration}
                currentTime={currentTime}
                isPlaying={isPlaying}
                selection={selectedRange}
                selectionMode={selectRegionMode}
                onSeek={seek}
                onSelectRange={(range) => {
                  setSelectedRange(range);
                  setSelectRegionMode(false);
                }}
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

              <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                <button
                  onClick={() => setSelectRegionMode((value) => !value)}
                  className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                    selectRegionMode
                      ? 'bg-amber-400/15 border-amber-300/40 text-amber-100'
                      : 'bg-white/[0.04] border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {selectRegionMode ? 'Drag on waveform' : 'Select region'}
                </button>
                {selectedRange && (
                  <>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatRange(selectedRange)}
                    </span>
                    <button
                      onClick={handleRegionRerun}
                      className="px-3 py-1.5 rounded-lg bg-amber-400/15 border border-amber-300/40 text-amber-100 text-[11px] font-semibold hover:bg-amber-400/20 transition-colors cursor-pointer"
                    >
                      Re-run selected region
                    </button>
                    <button
                      onClick={() => setSelectedRange(null)}
                      className="px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-slate-400 text-[11px] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                <label className="flex items-center gap-2 text-[11px] text-slate-400">
                  Speed
                  <select
                    value={playbackRate}
                    onChange={(event) => setPlaybackRate(Number(event.target.value))}
                    className="bg-white/[0.04] text-slate-100 border border-white/10 rounded-lg px-2 py-1 text-[11px] focus:border-sky-400 focus:outline-none"
                  >
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                      <option key={rate} value={rate}>
                        {rate}x
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={handleSetLoopStart}
                  className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-slate-300 text-[11px] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Set A
                </button>
                <button
                  onClick={handleSetLoopEnd}
                  className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-slate-300 text-[11px] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Set B
                </button>
                {loopRange && (
                  <>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Loop {formatRange(loopRange)}
                    </span>
                    <button
                      onClick={clearLoopRange}
                      className="px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-slate-400 text-[11px] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      Clear loop
                    </button>
                  </>
                )}
                <p className="w-full text-[10px] text-slate-500">
                  Shortcuts: Space play/pause, left/right seek 5s, Tab next word.
                </p>
              </div>
            </div>

            {originalRef.current !== null && originalRef.current !== captions && (
              <div className="flex items-center justify-between gap-2 px-1">
                <button
                  onClick={handleTeachCorrections}
                  className="text-[11px] font-medium text-sky-300 hover:text-sky-200 cursor-pointer transition-colors"
                  title="Save your edits as reusable corrections (applied automatically next time)"
                >
                  Remember my corrections
                </button>
                {learnedMsg && <span className="text-[10px] text-slate-500">{learnedMsg}</span>}
              </div>
            )}

            <TranscriptView
              captions={captions}
              currentTime={currentTime}
              onUpdateWord={(id, newText) =>
                editCaptions(captions.map((w) => (w.id === id ? { ...w, text: newText } : w)))
              }
              onPause={pause}
              onSeek={seek}
              onReplaceAll={replaceAll}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onRevert={handleRevert}
              canUndo={undoStack.length > 0}
              canRedo={redoStack.length > 0}
              canRevert={originalRef.current !== null && originalRef.current !== captions}
              silences={silences}
              onExportClip={handleExportClip}
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
