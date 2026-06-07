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
import { decodeAudioFile, computePeaks, extractWavClip } from './lib/audio';
import { deriveGlossaryRules, mergeGlossaryText } from './lib/glossary';
import { findSilences, type SilenceRange } from './lib/vad';
import { saveBlobFile, saveTextFile } from './lib/fileSave';
import { getStoredFlag, setStoredFlag } from './lib/storage';
import { availableTiers, defaultModel, type WhisperModel } from './lib/models';

const WELCOME_SEEN_KEY = 'spanish-whisper-seen-welcome';
const RESULT_TIP_SEEN_KEY = 'spanish-whisper-seen-result-tip';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const tiers = useMemo(() => availableTiers(), []);
  const [model, setModel] = useState<WhisperModel>(() => defaultModel());
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
  // Wave 2: real waveform peaks derived from decoded PCM.
  const [peaks, setPeaks] = useState<number[]>([]);
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

  const projectBaseRef = useRef<Omit<StoredProject, 'words' | 'translation' | 'updatedAt' | 'peaks'> | null>(null);
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
    setSilences([]);
    setPeaks([]);
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
      setPeaks([]);
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
    setPeaks([]);
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
    setPeaks([]);
    pendingSaveRef.current = true;
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

  // Initial save when a fresh transcription completes.
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
    // Peaks may not be ready yet (async decode) — they'll be included in the
    // autosave once computed.
    save({ ...base, words: captions, translation, updatedAt: Date.now() });
  }, [done, file, captions, translation, model, save]);

  // Autosave edits (debounced). Also fires when peaks become available so the
  // cached envelope is stored with the project.
  useEffect(() => {
    const base = projectBaseRef.current;
    if (!done || !base) return;
    const t = window.setTimeout(() => {
      save({
        ...base,
        words: captions,
        translation,
        peaks: peaks.length > 0 ? peaks : undefined,
        updatedAt: Date.now(),
      });
    }, 800);
    return () => window.clearTimeout(t);
  }, [captions, translation, peaks, done, save]);

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
    setPeaks([]);
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

    // Load cached peaks immediately for instant waveform render. The VAD effect
    // below will recompute silences (and confirm/refresh peaks) once the audio
    // is decoded asynchronously.
    setPeaks(p.peaks ?? []);

    setFile(restored);
    loadResult(p.words, p.translation);
    setShowLibrary(false);
  };

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

  // Wave 2: decode audio for VAD silences and compute peak envelope.
  // The decoded PCM is reused for both — one file read, two outputs.
  useEffect(() => {
    if (!done || !file) {
      setSilences([]);
      setPeaks([]);
      return;
    }

    let cancelled = false;
    decodeAudioFile(file)
      .then((decoded) => {
        if (cancelled) return;
        setSilences(findSilences(decoded.samples, 16000, { thresholdDb: -45, minSilenceSec: 0.5 }));
        setPeaks(computePeaks(decoded.samples));
      })
      .catch(() => {
        if (!cancelled) setSilences([]);
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

  // Keyboard shortcuts for playback. Tab is NOT intercepted here — leave it
  // for native DOM focus traversal.
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, done, seek, togglePlay]);

  return (
    <div className="relative flex flex-col h-screen max-h-screen text-slate-100 p-3 md:p-6 overflow-hidden">
      <div className="app-bg" aria-hidden="true" />

      {showWelcome && <WelcomeScreen onStart={handleDismissWelcome} />}
      <FaqModal open={showFaq} onClose={() => setShowFaq(false)} onShowWelcome={handleShowWelcomeAgain} />
      <LibraryModal
        open={showLibrary}
        onClose={() => setShowLibrary(false)}
        projects={projects}
        onOpenProject={handleOpenProject}
        onDeleteProject={remove}
      />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="relative z-10 glass rounded-2xl px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-gradient-to-br from-sky-400 to-blue-600 p-1.5 rounded-xl glow-azure">
            <Volume2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm md:text-base font-extrabold tracking-tight bg-gradient-to-r from-sky-300 to-blue-400 bg-clip-text text-transparent">
              Spanish Whisper Engine
            </h1>
            <p className="text-[11px] font-medium" style={{ color: 'var(--text-subtle)' }}>
              On-Device · No Server · Offline
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowLibrary(true)}
            aria-label="Open saved transcripts"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors cursor-pointer hover:bg-white/10"
            style={{ color: 'var(--text-muted)' }}
          >
            <Library className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowFaq(true)}
            aria-label="Open FAQ"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors cursor-pointer hover:bg-white/10"
            style={{ color: 'var(--text-muted)' }}
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-grow flex flex-col gap-3.5 my-3 overflow-y-auto pr-0.5">

        {/* Upload / options panel — always full-width */}
        <section className="glass rounded-2xl p-4">
          {!file ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-1 bg-white/[0.03] rounded-xl p-1">
                <button
                  onClick={() => setInputMode('file')}
                  className={`rounded-lg py-2 text-[11px] font-semibold transition-colors cursor-pointer min-h-[44px] ${
                    inputMode === 'file' ? 'bg-sky-500/20 text-sky-100' : 'hover:text-white'
                  }`}
                  style={inputMode !== 'file' ? { color: 'var(--text-subtle)' } : {}}
                >
                  Choose file
                </button>
                <button
                  onClick={() => setInputMode('record')}
                  className={`rounded-lg py-2 text-[11px] font-semibold transition-colors cursor-pointer min-h-[44px] ${
                    inputMode === 'record' ? 'bg-sky-500/20 text-sky-100' : 'hover:text-white'
                  }`}
                  style={inputMode !== 'record' ? { color: 'var(--text-subtle)' } : {}}
                >
                  Record
                </button>
              </div>

              {inputMode === 'file' ? (
                <div className="relative border-2 border-dashed border-white/10 hover:border-sky-400/50 rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors min-h-[120px]">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <FileAudio className="w-8 h-8 text-sky-300 mb-2" />
                  <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Choose Audio File</span>
                  <span className="text-[11px] mt-1" style={{ color: 'var(--text-subtle)' }}>MP3, WAV, M4A, OGG</span>
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center space-y-4">
                  <div className="mx-auto w-14 h-14 rounded-full bg-sky-500/15 border border-sky-400/20 flex items-center justify-center">
                    <Mic className="w-7 h-7 text-sky-200" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                      {recorder.status === 'recording' ? 'Recording...' : 'Record from microphone'}
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--text-subtle)' }}>
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
                  {recorder.error && (
                    <p className="text-[11px] text-rose-300">{recorder.error}</p>
                  )}
                  {recorder.status === 'recording' ? (
                    <button
                      onClick={recorder.stop}
                      className="inline-flex items-center gap-2 rounded-xl bg-rose-500/15 border border-rose-300/30 text-rose-100 px-4 py-2 text-xs font-semibold hover:bg-rose-500/20 transition-colors cursor-pointer min-h-[44px]"
                    >
                      <Square className="w-4 h-4" /> Stop recording
                    </button>
                  ) : (
                    <button
                      onClick={recorder.start}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 to-blue-600 text-white px-4 py-2 text-xs font-bold hover:from-sky-300 hover:to-blue-500 transition-colors cursor-pointer min-h-[44px]"
                    >
                      <Mic className="w-4 h-4" /> Start recording
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* File row */}
              <div className="flex items-start justify-between bg-white/[0.03] p-2.5 rounded-xl border border-white/10">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <FileAudio className="w-7 h-7 text-sky-300 shrink-0" />
                  <div className="overflow-hidden">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-muted)' }}>{file.name}</p>
                    <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--text-subtle)' }}>{formatBytes(file.size)}</p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 transition-colors min-h-[44px] px-2 shrink-0"
                >
                  Remove
                </button>
              </div>

              {/* Engine options */}
              {!isWorking && !done && (
                <div className="space-y-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] uppercase tracking-wide flex items-center gap-1" style={{ color: 'var(--text-subtle)' }}>
                      <Cpu className="w-3 h-3" /> Model
                    </span>
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value as WhisperModel)}
                      className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-2 text-xs focus:outline-none min-h-[44px]"
                      style={{ color: 'var(--text)', borderColor: 'var(--border)' }}
                    >
                      {tiers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}{t.recommended ? ' · recommended' : ''}
                        </option>
                      ))}
                    </select>
                    <span className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>
                      {tiers.find((t) => t.id === model)?.blurb}
                    </span>
                  </label>
                  <p className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                    <Languages className="w-3 h-3 text-sky-300" />
                    Outputs a Spanish transcript <span style={{ color: 'var(--text-subtle)' }}>+</span> English translation automatically.
                  </p>
                  <AdvancedOptions
                    vocab={vocab}
                    onVocabChange={setVocab}
                    highAccuracy={highAccuracy}
                    onHighAccuracyChange={setHighAccuracy}
                  />
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-rose-950/60 border border-rose-800/60 rounded-lg p-2.5 flex items-start gap-2 text-[11px] text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Engine error</p>
                    <p className="text-[11px] text-rose-400/80 mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              {/* Start */}
              {!isWorking && !done && (
                <button
                  onClick={handleStart}
                  className="w-full bg-gradient-to-r from-sky-400 to-blue-600 hover:from-sky-300 hover:to-blue-500 active:scale-[0.98] text-white font-bold py-3 rounded-xl text-sm transition-all glow-azure cursor-pointer min-h-[44px]"
                >
                  Transcribe &amp; Translate
                </button>
              )}

              {!isWorking && !done && (
                <p className="text-[11px] text-center font-mono" style={{ color: 'var(--text-subtle)' }}>
                  First run downloads the model once, then works fully offline.
                </p>
              )}

              {/* Re-run card */}
              {done && (
                <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--warn-border)', background: 'var(--warn-bg)' }}>
                  <p className="text-[11px]" style={{ color: 'var(--warn)' }}>
                    Re-run keeps this file selected so you can change the model or options. It will replace the current transcript, translation, and edits.
                  </p>
                  <button
                    onClick={handleRerun}
                    className="w-full border font-semibold py-2 rounded-xl text-xs transition-colors cursor-pointer min-h-[44px] hover:opacity-90"
                    style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'var(--warn-border)', color: 'var(--warn)' }}
                  >
                    Re-run with new settings
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Progress panel — full-width */}
        {isWorking && (
          <ProgressPanel
            status={status}
            modelProgress={modelProgress}
            progress={progress}
            onCancel={cancel}
          />
        )}

        {/* ── Results — two-pane on lg+, single-column on mobile ─────────── */}
        {done && (
          // Wave 3: on ≥1024px use a two-column grid so Spanish and English sit
          // side-by-side. On narrower screens falls back to single-column.
          <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start gap-3.5">

            {/* Left column: player + waveform + Spanish editor + export */}
            <div className="flex flex-col gap-3.5 min-w-0">

              {/* Result tip */}
              {showResultTip && (
                <div className="glass rounded-2xl p-3 flex items-start gap-3 border border-sky-400/20">
                  <Info className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
                  <div className="flex-grow">
                    <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Your transcript is ready.</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Tap any Spanish word to fix it, or open Read view for sentence-style editing and clip export.
                    </p>
                  </div>
                  <button
                    onClick={handleDismissResultTip}
                    className="text-[11px] hover:text-white transition-colors cursor-pointer min-h-[44px] flex items-center"
                    style={{ color: 'var(--text-subtle)' }}
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Player card: waveform + transport + region/loop controls */}
              <div className="glass rounded-2xl p-4 space-y-3">
                <AudioCanvas
                  duration={duration}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  peaks={peaks}
                  silences={silences}
                  selection={selectedRange}
                  selectionMode={selectRegionMode}
                  onSeek={seek}
                  onSelectRange={(range) => {
                    setSelectedRange(range);
                    setSelectRegionMode(false);
                  }}
                />

                {/* Transport row */}
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono" style={{ color: 'var(--text-subtle)' }}>
                    {formatTimeStr(currentTime)} / {formatTimeStr(duration)}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => seek(0)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-white/[0.04] border border-white/10 rounded-full hover:bg-white/10 hover:text-white transition-colors active:scale-90 cursor-pointer"
                      title="Restart"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={togglePlay}
                      className="p-3 bg-gradient-to-br from-sky-400 to-blue-600 text-white rounded-full hover:scale-105 active:scale-95 transition-all glow-azure cursor-pointer"
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] font-mono rounded-full px-2 py-0.5" style={{ background: 'var(--accent-bg)', color: 'var(--accent-bright)', border: '1px solid var(--accent-border)' }}>
                    <CheckCircle className="w-3.5 h-3.5" /> ES + EN
                  </div>
                </div>

                {/* Region controls */}
                <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                  <button
                    onClick={() => setSelectRegionMode((v) => !v)}
                    className={`px-3 min-h-[44px] rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                      selectRegionMode ? '' : 'hover:text-white hover:bg-white/10'
                    }`}
                    style={
                      selectRegionMode
                        ? { background: 'var(--warn-bg)', borderColor: 'var(--warn-border)', color: 'var(--warn)' }
                        : { background: 'rgba(255,255,255,0.04)', borderColor: 'var(--border)', color: 'var(--text-muted)' }
                    }
                  >
                    {selectRegionMode ? 'Drag on waveform' : 'Select region'}
                  </button>
                  {selectedRange && (
                    <>
                      <span className="text-[11px] font-mono" style={{ color: 'var(--text-subtle)' }}>
                        {formatRange(selectedRange)}
                      </span>
                      <button
                        onClick={handleRegionRerun}
                        className="px-3 min-h-[44px] rounded-lg text-[11px] font-semibold hover:opacity-90 transition-colors cursor-pointer"
                        style={{ background: 'var(--warn-bg)', borderColor: 'var(--warn-border)', border: '1px solid', color: 'var(--warn)' }}
                      >
                        Re-run selected region
                      </button>
                      <button
                        onClick={() => setSelectedRange(null)}
                        className="px-2.5 min-h-[44px] rounded-lg text-[11px] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'var(--border)', border: '1px solid', color: 'var(--text-subtle)' }}
                      >
                        Clear
                      </button>
                    </>
                  )}
                </div>

                {/* Speed + loop controls */}
                <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                  <label className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-subtle)' }}>
                    Speed
                    <select
                      value={playbackRate}
                      onChange={(e) => setPlaybackRate(Number(e.target.value))}
                      className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 text-[11px] focus:outline-none min-h-[44px]"
                      style={{ color: 'var(--text)' }}
                    >
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                        <option key={rate} value={rate}>{rate}x</option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={handleSetLoopStart}
                    className="px-2.5 min-h-[44px] rounded-lg text-[11px] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'var(--border)', border: '1px solid', color: 'var(--text-muted)' }}
                  >
                    Set A
                  </button>
                  <button
                    onClick={handleSetLoopEnd}
                    className="px-2.5 min-h-[44px] rounded-lg text-[11px] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'var(--border)', border: '1px solid', color: 'var(--text-muted)' }}
                  >
                    Set B
                  </button>
                  {loopRange && (
                    <>
                      <span className="text-[11px] font-mono" style={{ color: 'var(--text-subtle)' }}>
                        Loop {formatRange(loopRange)}
                      </span>
                      <button
                        onClick={clearLoopRange}
                        className="px-2.5 min-h-[44px] rounded-lg text-[11px] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'var(--border)', border: '1px solid', color: 'var(--text-subtle)' }}
                      >
                        Clear loop
                      </button>
                    </>
                  )}
                  <p className="w-full text-[11px]" style={{ color: 'var(--text-subtle)' }}>
                    Shortcuts: Space play/pause · ← / → seek 5s
                  </p>
                </div>
              </div>

              {/* "Remember corrections" inline link */}
              {originalRef.current !== null && originalRef.current !== captions && (
                <div className="flex items-center justify-between gap-2 px-1">
                  <button
                    onClick={handleTeachCorrections}
                    className="text-[11px] font-medium hover:text-sky-200 cursor-pointer transition-colors min-h-[44px]"
                    style={{ color: 'var(--accent-bright)' }}
                    title="Save your edits as reusable corrections"
                  >
                    Remember my corrections
                  </button>
                  {learnedMsg && <span className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>{learnedMsg}</span>}
                </div>
              )}

              {/* Spanish editor */}
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

              {/* Export panel — in left column so it's reachable after reading */}
              <CaptionExport
                captions={captions}
                translation={translation}
                fileName={file ? file.name : 'spanish-captions'}
              />
            </div>

            {/* Right column: synced English translation — sticky on tablet */}
            <div className="lg:sticky lg:top-0 lg:self-start lg:max-h-[calc(100svh-6rem)] lg:overflow-y-auto">
              <TranslationPanel
                translation={translation}
                currentTime={currentTime}
                onSeek={seek}
              />
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 text-[11px] text-center py-1.5 mt-auto flex items-center justify-center gap-1 font-mono" style={{ color: 'var(--text-subtle)' }}>
        <Info className="w-3 h-3" /> On-Device Spanish Whisper &bull; Offline &bull; No Server
      </footer>
    </div>
  );
}
