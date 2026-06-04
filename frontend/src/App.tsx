import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  FileAudio,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Info
} from 'lucide-react';
import { useChunkUploader } from './hooks/useChunkUploader';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { AudioCanvas } from './components/AudioCanvas';
import { CaptionEditor, CaptionWord } from './components/CaptionEditor';
import { CaptionExport } from './components/CaptionExport';

// Defensive JSON fetch: guards against the dev proxy / SPA fallback serving an
// HTML document (e.g. index.html) when the backend is offline. Parsing that as
// JSON throws "unexpected token '<'", so we validate the content-type first and
// surface a clear error instead.
async function fetchJson(input: RequestInfo, init?: RequestInit): Promise<any> {
  const res = await fetch(input, init);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    await res.text().catch(() => '');
    throw new Error(
      `Expected JSON but received '${contentType || 'unknown'}' (status ${res.status}). ` +
        `Is the ingestion server running on port 8000?`
    );
  }
  if (!res.ok) {
    let detail = `Status ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || body.error || detail;
    } catch {
      /* keep default detail */
    }
    throw new Error(detail);
  }
  return res.json();
}

export default function App() {
  const [captions, setCaptions] = useState<CaptionWord[]>([]);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionDone, setTranscriptionDone] = useState(false);
  
  const [jobStatus, setJobStatus] = useState<string>('idle');
  const [serverLogs, setServerLogs] = useState<string>('');
  const [backendProgress, setBackendProgress] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // null = checking, true = reachable, false = offline
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const pollingIntervalRef = useRef<number | null>(null);

  // Hook 1: Uploader
  const {
    uploadId,
    currentFile,
    isUploading,
    progress: uploadProgress,
    error: uploadError,
    pendingResume,
    setFile,
    startUpload,
    resumeUpload,
    resetUploader,
  } = useChunkUploader({
    chunkSize: 2 * 1024 * 1024, // Fixed 2MB chunks client-side for performance
    uploadEndpoint: '/api/upload-chunk'
  });

  // Hook 2: Audio Player
  const {
    isPlaying,
    currentTime,
    duration,
    setSrc,
    pause,
    togglePlay,
    seek,
  } = useAudioPlayer();

  // Clear polling timers safely on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  // Probe backend connectivity at mount so we can warn before any upload attempt
  useEffect(() => {
    let cancelled = false;
    const checkHealth = async () => {
      try {
        const data = await fetchJson('/api/health');
        if (!cancelled) setBackendOnline(data.status === 'ok');
      } catch {
        if (!cancelled) setBackendOnline(false);
      }
    };
    checkHealth();
    return () => {
      cancelled = true;
    };
  }, []);

  // Handle local file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setFile(file);
      setTranscriptionDone(false);
      setTranscribing(false);
      setCaptions([]);
      setJobStatus('idle');
      setServerLogs('');
      setBackendProgress(0);
      setErrorMsg(null);
    }
  };

  const startPolling = (jobId: string) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    
    pollingIntervalRef.current = window.setInterval(async () => {
      try {
        const data = await fetchJson(`/api/jobs/${jobId}`);
        setJobStatus(data.status);
        
        if (data.status === 'processing') {
          setServerLogs("FFmpeg execution active... Downsampling audio layers to 16kHz Mono PCM.");
          setBackendProgress(60);
        } else if (data.status === 'queued') {
          setServerLogs("Job is queued in background thread pool executor.");
          setBackendProgress(30);
        } else if (data.status === 'failed') {
          setServerLogs(`Pipeline execution abort: ${data.error}`);
          setErrorMsg(data.error || 'Internal engine error during translation.');
          setTranscribing(false);
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        } else if (data.status === 'completed') {
          setServerLogs("Inference sequence complete. Injecting transcript segments into local state.");
          setBackendProgress(100);
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          fetchFinalTranscript(jobId);
        }
      } catch (err: any) {
        setServerLogs(`Polling link disconnect: ${err.message}`);
      }
    }, 1500);
  };

  const fetchFinalTranscript = async (jobId: string) => {
    try {
      const data = await fetchJson(`/api/jobs/${jobId}/export?format=json`);

      // Load local file to player for immediate playback scrubbing
      if (currentFile) {
        const audioUrl = URL.createObjectURL(currentFile);
        setSrc(audioUrl);
      }

      const mappedWords: CaptionWord[] = data.transcript.map((w: any, idx: number) => ({
        id: `word-${idx}`,
        text: w.word,
        start: w.start,
        end: w.end,
      }));

      setCaptions(mappedWords);
      setTranscribing(false);
      setTranscriptionDone(true);
    } catch (err: any) {
      setServerLogs(`Data retrieval exception: ${err.message}`);
      setErrorMsg(err.message);
      setTranscribing(false);
    }
  };

  // Trigger processing when upload finishes
  useEffect(() => {
    if (uploadProgress === 100 && uploadId && currentFile && !transcribing && !transcriptionDone && jobStatus === 'idle') {
      const triggerProcessing = async () => {
        setTranscribing(true);
        setJobStatus('queued');
        setServerLogs("All bytes safely appended to target file. Triggering pipeline process execution request...");
        try {
          await fetchJson(`/api/jobs/${uploadId}/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uploadId })
          });

          startPolling(uploadId);
        } catch (err: any) {
          setJobStatus('failed');
          setServerLogs(`Execution init failure: ${err.message}`);
          setErrorMsg(err.message);
          setTranscribing(false);
        }
      };
      
      triggerProcessing();
    }
  }, [uploadProgress, uploadId, currentFile, transcribing, transcriptionDone, jobStatus]);

  const handleReset = () => {
    resetUploader();
    setTranscriptionDone(false);
    setTranscribing(false);
    setCaptions([]);
    setJobStatus('idle');
    setServerLogs('');
    setBackendProgress(0);
    setErrorMsg(null);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  // Human-readable size converter
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format playback time (MM:SS)
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
              Spanish Ingestion Engine
            </h1>
            <p className="text-[10px] text-slate-500 font-medium">Mobile-First Transcript Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-full px-2.5 py-1 text-[9px] font-mono text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
          OFFLINE (LOCAL)
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-grow flex flex-col gap-3.5 my-3 overflow-y-auto pr-0.5">

        {/* Backend offline banner */}
        {backendOnline === false && (
          <div className="bg-rose-950/70 border border-rose-700/70 rounded-xl p-3 flex items-center gap-2.5 text-[11px] text-rose-200 shadow-lg">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <p className="font-bold">⚠️ Ingestion Engine Offline</p>
              <p className="text-[10px] text-rose-300/80 mt-0.5 font-mono">
                Run the uvicorn server on port 8000 to enable uploads.
              </p>
            </div>
          </div>
        )}

        {/* Upload Panel */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
          {!currentFile ? (
            <div className={`relative border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center text-center transition-colors ${backendOnline === false ? 'border-slate-800 opacity-40' : 'border-slate-800 hover:border-indigo-500/50'}`}>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                disabled={backendOnline === false}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <Upload className="w-8 h-8 text-indigo-400 mb-2" />
              <span className="text-xs font-semibold text-slate-200">Choose Audio File</span>
              <span className="text-[10px] text-slate-500 mt-1">MP3, WAV, M4A, OGG</span>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="flex items-start justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <FileAudio className="w-7 h-7 text-indigo-400 shrink-0" />
                  <div className="overflow-hidden">
                    <p className="text-xs font-semibold truncate text-slate-200">{currentFile.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{formatBytes(currentFile.size)}</p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 transition-colors p-1"
                >
                  Remove
                </button>
              </div>

              {/* localStorage resume alerts */}
              {pendingResume && (
                <div className="bg-amber-950/60 border border-amber-800/60 rounded-lg p-2.5 flex items-start gap-2 text-[11px] text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-grow">
                    <p className="font-semibold">Interrupted upload detected</p>
                    <p className="text-[10px] text-amber-400/80 mt-0.5">
                      Resumable from chunk {pendingResume.nextChunkIndex} of {pendingResume.totalChunks}.
                    </p>
                    <button
                      onClick={resumeUpload}
                      disabled={isUploading}
                      className="mt-2 bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded text-[10px] hover:bg-amber-400 transition-colors"
                    >
                      Resume Upload
                    </button>
                  </div>
                </div>
              )}

              {/* Upload or backend errors */}
              {(uploadError || errorMsg) && (
                <div className="bg-rose-950/60 border border-rose-800/60 rounded-lg p-2.5 flex items-start gap-2 text-[11px] text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Pipeline failure event</p>
                    <p className="text-[10px] text-rose-400/80 mt-0.5">{uploadError || errorMsg}</p>
                  </div>
                </div>
              )}

              {/* Progress and trigger bar */}
              <div className="space-y-2">
                {isUploading && (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>Uploading 2MB blocks...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                )}
                
                {uploadProgress > 0 && !transcribing && !transcriptionDone && (
                  <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-pink-500 h-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}

                {uploadProgress === 0 && !isUploading && (
                  <button
                    onClick={startUpload}
                    disabled={backendOnline === false}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-bold py-2 rounded-lg text-xs transition-all shadow-md shadow-indigo-600/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"
                  >
                    Start Segmented Upload
                  </button>
                )}

                {isUploading && (
                  <div className="text-[10px] text-slate-500 text-center flex items-center justify-center gap-1.5 animate-pulse mt-1">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Chunk uploader holds state index locally
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Engine Pipeline Status */}
        {transcribing && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col items-center justify-center text-center py-8 space-y-4">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
            <div>
              <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">
                Pipeline Phase: <span className="text-indigo-400">{jobStatus}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1 font-mono">{serverLogs}</p>
            </div>
            
            <div className="w-full max-w-md bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
              <div
                className="bg-gradient-to-r from-indigo-500 to-pink-500 h-full transition-all duration-300"
                style={{ width: `${backendProgress}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Processing: {backendProgress}%
            </div>
          </div>
        )}

        {/* Player controls, Canvas, and Editor (Active post-upload & process completion) */}
        {transcriptionDone && !transcribing && (
          <>
            {/* Visualizer and Scrub controls */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
              <AudioCanvas
                duration={duration}
                currentTime={currentTime}
                isPlaying={isPlaying}
                onSeek={seek}
              />

              <div className="flex items-center justify-between">
                {/* Time stamps */}
                <div className="text-xs font-mono text-slate-400">
                  {formatTimeStr(currentTime)} / {formatTimeStr(duration)}
                </div>

                {/* Main controls */}
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

                {/* Subtitle helper badge */}
                <div className="flex items-center gap-1 text-[10px] bg-indigo-950/40 text-indigo-400 border border-indigo-900/60 rounded px-2 py-0.5 font-mono">
                  <CheckCircle className="w-3.5 h-3.5" /> ALIGNED
                </div>
              </div>
            </div>

            {/* Subtitle Words Editor */}
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

            {/* Exporter UI */}
            <CaptionExport 
              captions={captions} 
              fileName={currentFile ? currentFile.name : 'spanish-captions'} 
            />
          </>
        )}
      </main>

      {/* Info footer */}
      <footer className="text-[10px] text-slate-600 text-center py-1.5 border-t border-slate-900 mt-auto flex items-center justify-center gap-1 font-mono">
        <Info className="w-3 h-3 text-slate-500" /> Spanish Audio Ingestion Engine &bull; Touch Optimized
      </footer>
    </div>
  );
}
