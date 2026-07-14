import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  FileAudio,
  CheckCircle,
  AlertTriangle,
  Info,
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
import { ShellTools } from './components/ShellTools';
import { ConfirmDialog } from './components/ConfirmDialog';
import { useConfirmDialog } from './hooks/useConfirmDialog';
import type { Sentence } from './lib/punctuation';
import { newProjectId, type StoredProject } from './lib/db';
import { decodeAudioFile, computePeaks, extractWavClip } from './lib/audio';
import { deriveGlossaryRules, mergeGlossaryText } from './lib/glossary';
import { findSilences, type SilenceRange } from './lib/vad';
import { saveBlobFile, saveTextFile } from './lib/fileSave';
import { getStoredFlag, setStoredFlag } from './lib/storage';
import { availableTiers, defaultModel, type WhisperModel } from './lib/models';
import { validateAudioFile } from './lib/uiState';
import { notify } from './lib/toast';

const RESULT_TIP_SEEN_KEY = 'dexterpreter-seen-result-tip';

export default function App() {
  const confirmDialog = useConfirmDialog();
  const [file, setFile] = useState<File | null>(null);
  const tiers = useMemo(() => availableTiers(), []);
  const [model, setModel] = useState<WhisperModel>(() => defaultModel());
  const [vocab, setVocab] = useState('');
  const [highAccuracy, setHighAccuracy] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
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
  const [retainAudio, setRetainAudio] = useState(true);
  const [resultTab, setResultTab] = useState<'spanish' | 'english'>('spanish');
  const [fileError, setFileError] = useState<string | null>(null);
  const [sourceAudioAvailable, setSourceAudioAvailable] = useState(false);
  const [resultSaveState, setResultSaveState] = useState<'not-started' | 'saving' | 'saved' | 'error'>('not-started');

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

  const { projects, status: projectStatus, error: projectError, refresh: refreshProjects, save, open, remove } = useProjects();
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
      setLearnedMsg('No new corrections to use on the next run.');
      return;
    }
    setVocab((v) => mergeGlossaryText(v, learned));
    setLearnedMsg(
      `Added ${learned.length} correction${learned.length === 1 ? '' : 's'} for this session.`
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
  const saveSequenceRef = useRef(0);

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

  const saveResult = useCallback((project: StoredProject) => {
    const sequence = ++saveSequenceRef.current;
    setResultSaveState('saving');
    void save(project).then(
      () => { if (sequence === saveSequenceRef.current) setResultSaveState('saved'); },
      () => { if (sequence === saveSequenceRef.current) setResultSaveState('error'); }
    );
  }, [save]);

  const isWorking =
    status === 'decoding' ||
    status === 'loading-model' ||
    status === 'transcribing' ||
    status === 'translating';
  const done = status === 'done';

  useEffect(() => {
    if (done && file && sourceAudioAvailable) {
      const url = URL.createObjectURL(file);
      setSrc(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [done, file, setSrc, sourceAudioAvailable]);

  useEffect(() => {
    if (!recorder.file) return;
    const validationError = validateAudioFile(recorder.file);
    if (validationError) {
      setFileError(validationError);
      return;
    }
    setFileError(null);
    setSourceAudioAvailable(true);
    setResultSaveState('not-started');
    setResultTab('spanish');
    setLearnedMsg(null);
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
      const selected = e.target.files[0];
      const validationError = validateAudioFile(selected);
      setFileError(validationError);
      if (validationError) { e.target.value = ''; return; }
      setSourceAudioAvailable(true);
      setResultSaveState('not-started');
      setResultTab('spanish');
      setLearnedMsg(null);
      pause();
      clearLoopRange();
      seek(0);
      setSrc(null);
      setFile(selected);
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
    setFileError(null);
    setResultTab('spanish');
    setLearnedMsg(null);
    setSourceAudioAvailable(false);
    setResultSaveState('not-started');
    projectBaseRef.current = null;
    setSelectedRange(null);
    setSelectRegionMode(false);
    setSilences([]);
    setPeaks([]);
    resetHistory();
    reset();
    clearDecodedAudio();
    recorder.clear();
    pause();
    clearLoopRange();
    seek(0);
    setSrc(null);
  };

  const handleStart = () => {
    if (!file || !sourceAudioAvailable) return;
    setResultSaveState('not-started');
    setSelectedRange(null);
    setSelectRegionMode(false);
    setSilences([]);
    setPeaks([]);
    pendingSaveRef.current = true;
    run(file, { model, language: 'spanish', glossary: vocab.trim() || undefined, highAccuracy });
  };

  const handleDismissWelcome = () => {
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
      audioBlob: retainAudio ? (file as Blob) : new Blob([], { type: 'application/x-dexterpreter-transcript-only' }),
    };
    projectBaseRef.current = base;
    originalRef.current = captions;
    setUndoStack([]);
    setRedoStack([]);
    // Peaks may not be ready yet (async decode) — they'll be included in the
    // autosave once computed.
    saveResult({ ...base, words: captions, translation, updatedAt: Date.now() });
  }, [done, file, captions, translation, model, retainAudio, saveResult]);

  // Autosave edits (debounced). Also fires when peaks become available so the
  // cached envelope is stored with the project.
  useEffect(() => {
    const base = projectBaseRef.current;
    if (!done || !base) return;
    const t = window.setTimeout(() => {
      saveResult({
        ...base,
        words: captions,
        translation,
        peaks: peaks.length > 0 ? peaks : undefined,
        updatedAt: Date.now(),
      });
    }, 800);
    return () => window.clearTimeout(t);
  }, [captions, translation, peaks, done, saveResult]);

  const handleRerun = async () => {
    const confirmed = await confirmDialog.confirm({
      title: 'Re-run this file?',
      description:
        'The current transcript, translation, and edits will be replaced. Your selected audio file stays loaded so you can change model or options first.',
      confirmLabel: 'Re-run file',
      tone: 'warning',
    });
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

  const handleRegionRerun = async () => {
    if (!file || !selectedRange || !sourceAudioAvailable) return;

    const confirmed = await confirmDialog.confirm({
      title: 'Re-run selected region?',
      description: `Words and translation between ${formatRange(selectedRange)} will be replaced. Everything outside that range will be kept.`,
      confirmLabel: 'Re-run region',
      tone: 'warning',
    });
    if (!confirmed) return;

    setUndoStack((s) => [...s, captions]);
    setRedoStack([]);
    runRegion(file, selectedRange, runOptions);
  };

  const handleExportClip = async (sentence: Sentence) => {
    if (!file || !sourceAudioAvailable) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '') || 'audio-clip';
    const clipName = `${baseName}-${Math.round(sentence.start)}-${Math.round(sentence.end)}`;
    try {
      const wav = await extractWavClip(file, sentence.start, sentence.end);
      await saveBlobFile(`${clipName}.wav`, wav);
      await saveTextFile(`${clipName}.txt`, 'text/plain;charset=utf-8', `${sentence.text}\n`);
      notify(`Saved ${clipName}.wav and transcript text`, 'success');
    } catch (cause) {
      notify(`Clip export failed. (${cause instanceof Error ? cause.message : String(cause)})`, 'error');
    }
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
    seek(0);
    clearLoopRange();
    setSelectedRange(null);
    setSelectRegionMode(false);
    setSilences([]);
    setResultTab('spanish');
    setLearnedMsg(null);
    setUndoStack([]);
    setRedoStack([]);

    const restored = p.audioBlob.size > 0
      ? new File([p.audioBlob], `${p.name}.audio`, { type: p.audioBlob.type || 'audio/*' })
      : new File([], `${p.name}.transcript-only`, { type: 'application/x-dexterpreter-transcript-only' });

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

    const hasStoredAudio = p.audioBlob.size > 0;
    setSourceAudioAvailable(hasStoredAudio);
    setRetainAudio(hasStoredAudio);
    setResultSaveState('saved');
    setFile(restored);
    loadResult(p.words, p.translation);
    setShowLibrary(false);
  };

  const handleDeleteProject = async (id: string) => {
    const deletingCurrent = projectBaseRef.current?.id === id;
    await remove(id);
    if (deletingCurrent) {
      setShowLibrary(false);
      handleReset();
    }
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

  const handleResultTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, current: 'spanish' | 'english') => {
    let next: 'spanish' | 'english' | null = null;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') next = current === 'spanish' ? 'english' : 'spanish';
    else if (event.key === 'Home') next = 'spanish';
    else if (event.key === 'End') next = 'english';
    if (!next) return;
    event.preventDefault();
    setResultTab(next);
    window.requestAnimationFrame(() => document.getElementById(`${next}-result-tab`)?.focus());
  };

  // Wave 2: decode audio for VAD silences and compute peak envelope.
  // The decoded PCM is reused for both — one file read, two outputs.
  useEffect(() => {
    if (!done || !file || !sourceAudioAvailable) {
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
  }, [done, file, sourceAudioAvailable]);

  const formatElapsedMs = (ms: number) => {
    const seconds = Math.round(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Playback shortcuts never override the native keyboard behavior of focused controls.
  useEffect(() => {
    const isInteractiveTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return target.isContentEditable || Boolean(target.closest('button, a, input, textarea, select, summary, [role=\"button\"], [role=\"tab\"], [role=\"menuitem\"]'));
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const dialogOpen = showFaq || showLibrary || showWelcome || Boolean(confirmDialog.request);
      if (!done || !sourceAudioAvailable || dialogOpen || isInteractiveTarget(event.target)) return;
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
  }, [confirmDialog.request, currentTime, done, seek, showFaq, showLibrary, showWelcome, sourceAudioAvailable, togglePlay]);

  return (
    <div className="app-shell relative flex flex-col text-slate-100 p-3 md:p-6">
      <div className="app-bg" aria-hidden="true" />

      {showWelcome && <WelcomeScreen onStart={handleDismissWelcome} />}
      <FaqModal open={showFaq} onClose={() => setShowFaq(false)} onShowWelcome={handleShowWelcomeAgain} />
      <LibraryModal
        open={showLibrary}
        onClose={() => setShowLibrary(false)}
        projects={projects}
        status={projectStatus}
        error={projectError}
        onRetry={() => void refreshProjects()}
        onOpenProject={handleOpenProject}
        onDeleteProject={handleDeleteProject}
      />
      {confirmDialog.request && (
        <ConfirmDialog
          open={Boolean(confirmDialog.request)}
          title={confirmDialog.request.title}
          description={confirmDialog.request.description}
          confirmLabel={confirmDialog.request.confirmLabel}
          cancelLabel={confirmDialog.request.cancelLabel}
          tone={confirmDialog.request.tone}
          onConfirm={confirmDialog.handleConfirm}
          onCancel={confirmDialog.handleCancel}
        />
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="app-header relative z-10 rounded-2xl px-3 py-2 flex items-center justify-between">
        <div className="app-header__brand flex items-center gap-2.5">
          <div className="bg-gradient-to-br from-sky-400 to-blue-600 p-1.5 rounded-xl glow-azure">
            <Volume2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm md:text-base font-extrabold tracking-tight bg-gradient-to-r from-sky-300 to-blue-400 bg-clip-text text-transparent">
              Dexterpreter
            </h1>
            <p className="text-[11px] font-medium" style={{ color: 'var(--text-subtle)' }}>
              Spanish transcription and English translation on this device
            </p>
          </div>
        </div>
        <div className="app-header__actions">
          <ShellTools />
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
      <main className="app-main relative z-10 flex-grow">

        {/* Upload / options panel — always full-width */}
        <section className="primary-workspace">
          {!file ? (
            <div className="space-y-3">
              <div className="start-heading">
                <p className="eyebrow">New transcription</p>
                <h2>Transcribe Spanish audio</h2>
                <p>Choose an audio file or record speech. The app creates a Spanish transcript and then attempts an English translation.</p>
              </div>
              {fileError && (
                <div className="state-message state-message--error" role="alert">
                  <AlertTriangle aria-hidden="true" />
                  <div><strong>File not supported</strong><p>{fileError}</p></div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-1 bg-white/[0.03] rounded-xl p-1" role="group" aria-label="Audio input method">
                <button
                  onClick={() => setInputMode('file')}
                  aria-pressed={inputMode === 'file'}
                  className={`rounded-lg py-2 text-[11px] font-semibold transition-colors cursor-pointer min-h-[44px] ${
                    inputMode === 'file' ? 'bg-sky-500/20 text-sky-100' : 'hover:text-white'
                  }`}
                  style={inputMode !== 'file' ? { color: 'var(--text-subtle)' } : {}}
                >
                  Choose file
                </button>
                <button
                  onClick={() => setInputMode('record')}
                  aria-pressed={inputMode === 'record'}
                  className={`rounded-lg py-2 text-[11px] font-semibold transition-colors cursor-pointer min-h-[44px] ${
                    inputMode === 'record' ? 'bg-sky-500/20 text-sky-100' : 'hover:text-white'
                  }`}
                  style={inputMode !== 'record' ? { color: 'var(--text-subtle)' } : {}}
                >
                  Record
                </button>
              </div>

              {inputMode === 'file' ? (
                <div className="file-drop-zone relative border-2 border-dashed border-white/10 hover:border-sky-400/50 rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors min-h-[120px]">
                  <input
                    type="file"
                    accept="audio/*"
                    aria-label="Choose an audio file to transcribe"
                    aria-describedby="audio-file-help"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <FileAudio className="w-8 h-8 text-sky-300 mb-2" />
                  <span className="text-base font-semibold" style={{ color: 'var(--text)' }}>Choose audio file</span>
                  <span id="audio-file-help" className="text-sm mt-1" style={{ color: 'var(--text-subtle)' }}>MP3, WAV, M4A, OGG, WebM, AAC, FLAC, or MP4 · 200 MB upload limit</span>
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center space-y-4">
                  <div className="mx-auto w-14 h-14 rounded-full bg-sky-500/15 border border-sky-400/20 flex items-center justify-center">
                    <Mic className="w-7 h-7 text-sky-200" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                      {recorder.status === 'requesting' ? 'Requesting microphone access…' : recorder.status === 'recording' ? 'Recording…' : 'Record from microphone'}
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--text-subtle)' }}>
                      {recorder.status === 'recording'
                        ? formatElapsedMs(recorder.elapsedMs)
                        : 'When you stop, the recording loads like any other audio file.'}
                    </p>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden border border-white/10" role="progressbar" aria-label="Microphone input level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(recorder.level * 100)}>
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
                      disabled={recorder.status === 'requesting'}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 to-blue-600 text-white px-4 py-2 text-xs font-bold hover:from-sky-300 hover:to-blue-500 transition-colors cursor-pointer min-h-[44px]"
                    >
                      <Mic className="w-4 h-4" /> {recorder.status === 'requesting' ? 'Waiting for permission…' : 'Start recording'}
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

              {!isWorking && !done && (
                <AdvancedOptions
                  model={model}
                  tiers={tiers}
                  onModelChange={setModel}
                  vocab={vocab}
                  onVocabChange={setVocab}
                  highAccuracy={highAccuracy}
                  onHighAccuracyChange={setHighAccuracy}
                  retainAudio={retainAudio}
                  onRetainAudioChange={setRetainAudio}
                />
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
                  Audio is processed on this device. Uncached model files require an internet connection once.
                </p>
              )}

              {/* Re-run card */}
              {done && sourceAudioAvailable && (
                <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--warn-border)', background: 'var(--warn-bg)' }}>
                  <p className="text-[11px]" style={{ color: 'var(--warn)' }}>
                    Change settings keeps this file selected and returns to the run controls. Starting again will replace the current transcript, translation, and edits.
                  </p>
                  <button
                    onClick={handleRerun}
                    className="w-full border font-semibold py-2 rounded-xl text-xs transition-colors cursor-pointer min-h-[44px] hover:opacity-90"
                    style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'var(--warn-border)', color: 'var(--warn)' }}
                  >
                    Change settings before re-running
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

        {done && (
          <div className="space-y-3">
            <div className="result-status" role="status">
              <span className="status-chip" data-state="complete"><CheckCircle aria-hidden="true" /> Spanish transcript complete</span>
              <span className="status-chip" data-state={translation?.warning || !translation?.segments.some((segment) => segment.text.trim()) ? 'warning' : 'complete'}>
                <Languages aria-hidden="true" /> {translation?.warning ? 'English translation incomplete' : translation?.segments.some((segment) => segment.text.trim()) ? 'English translation complete' : 'English translation unavailable'}
              </span>
              <span className="status-chip" data-state={resultSaveState === 'error' ? 'error' : resultSaveState === 'saved' ? 'complete' : 'warning'}>
                {resultSaveState === 'saving' ? 'Saving on this device…' : resultSaveState === 'saved' ? 'Saved on this device' : resultSaveState === 'error' ? 'Not saved' : 'Save pending'}
              </span>
              <span className="status-chip">{resultSaveState === 'saved' ? (retainAudio ? 'Source audio saved with project' : 'Saved project is transcript only') : (retainAudio ? 'Source audio retention selected' : 'Transcript-only saving selected')}</span>
            </div>
            {translation?.warning && <div className="state-message state-message--warning" role="status"><AlertTriangle aria-hidden="true" /><div><strong>English translation is incomplete</strong><p>{translation.warning} The Spanish transcript is complete.</p></div></div>}
            <div className="mobile-result-tabs" role="tablist" aria-label="Result language">
              <button id="spanish-result-tab" type="button" role="tab" tabIndex={resultTab === 'spanish' ? 0 : -1} aria-selected={resultTab === 'spanish'} aria-controls="spanish-result-panel" onClick={() => setResultTab('spanish')} onKeyDown={(event) => handleResultTabKeyDown(event, 'spanish')}>Spanish</button>
              <button id="english-result-tab" type="button" role="tab" tabIndex={resultTab === 'english' ? 0 : -1} aria-selected={resultTab === 'english'} aria-controls="english-result-panel" onClick={() => setResultTab('english')} onKeyDown={(event) => handleResultTabKeyDown(event, 'english')}>English</button>
            </div>
            <div className="results-grid">

            {/* Left column: player + waveform + Spanish editor + export */}
            <div id="spanish-result-panel" role="tabpanel" aria-labelledby="spanish-result-tab" className="result-pane flex flex-col gap-3.5 min-w-0" data-active={resultTab === 'spanish'}>

              {/* Result tip */}
              {showResultTip && (
                <div className="glass rounded-2xl p-3 flex items-start gap-3 border border-sky-400/20">
                  <Info className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
                  <div className="flex-grow">
                    <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Your transcript is ready.</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Read the result first. Open Edit words only when you need timestamped corrections.
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
              {sourceAudioAvailable ? (
              <div className="player-card space-y-3">
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
                      title="Restart audio"
                      aria-label="Restart audio"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={togglePlay}
                      aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
                      className="p-3 bg-gradient-to-br from-sky-400 to-blue-600 text-white rounded-full hover:scale-105 active:scale-95 transition-all glow-azure cursor-pointer"
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] font-mono rounded-full px-2 py-0.5" style={{ background: 'var(--accent-bg)', color: 'var(--accent-bright)', border: '1px solid var(--accent-border)' }}>
                    <CheckCircle className="w-3.5 h-3.5" /> ES + EN
                  </div>
                </div>

                <details className="advanced-editing">
                  <summary>Advanced audio editing</summary>
                {/* Region controls */}
                <div className="flex flex-wrap items-center gap-2 pt-3">
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
                </details>
              </div>
              ) : (
                <div className="state-message" role="status"><Info aria-hidden="true" /><div><strong>Transcript-only project</strong><p>The source audio was not retained, so playback, seeking, clips, looping, and reprocessing are unavailable.</p></div></div>
              )}

              {/* "Remember corrections" inline link */}
              {originalRef.current !== null && originalRef.current !== captions && (
                <div className="flex items-center justify-between gap-2 px-1">
                  <button
                    onClick={handleTeachCorrections}
                    className="text-[11px] font-medium hover:text-sky-200 cursor-pointer transition-colors min-h-[44px]"
                    style={{ color: 'var(--accent-bright)' }}
                    title="Use these edits as corrections during the next run in this session"
                  >
                    Use edits on next run
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
                onExportClip={sourceAudioAvailable ? handleExportClip : undefined}
                audioAvailable={sourceAudioAvailable}
              />

              {/* Export panel — in left column so it's reachable after reading */}
              <CaptionExport
                captions={captions}
                translation={translation}
                fileName={file ? file.name : 'spanish-captions'}
              />
            </div>

            {/* Right column: synced English translation — sticky on tablet */}
            <div id="english-result-panel" role="tabpanel" aria-labelledby="english-result-tab" className="result-pane translation-pane" data-active={resultTab === 'english'}>
              <TranslationPanel
                translation={translation}
                currentTime={currentTime}
                onSeek={seek}
                audioAvailable={sourceAudioAvailable}
              />
            </div>
          </div>
          </div>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 text-[11px] text-center py-1.5 mt-auto flex items-center justify-center gap-1 font-mono" style={{ color: 'var(--text-subtle)' }}>
        <Info className="w-3 h-3" /> Audio and transcripts are processed locally; uncached models download when needed
      </footer>
    </div>
  );
}
