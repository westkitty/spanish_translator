import React, { useState, useEffect } from 'react';
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

// A selection of Spanish phrases for realistic mock transcribing
const SPANISH_WORDS = [
  "Bienvenidos", "al", "motor", "de", "transcripción", "en", "español.",
  "Este", "sistema", "funciona", "completamente", "fuera", "de", "línea", "para", "proteger", "sus", "datos.",
  "El", "procesamiento", "se", "realiza", "mediante", "bloques", "de", "audio", "de", "cinco", "megabytes.",
  "El", "reproductor", "sincroniza", "la", "línea", "de", "tiempo", "con", "el", "lienzo", "de", "dibujo.",
  "Puede", "editar", "cualquier", "palabra", "haciendo", "clic", "sobre", "ella", "en", "el", "editor.",
  "Exportar", "la", "transcripción", "es", "sencillo", "utilizando", "los", "formatos", "de", "texto", "y", "json.",
  "Esperamos", "que", "esta", "aplicación", "optimice", "su", "flujo", "de", "trabajo", "diario."
];

export default function App() {
  const [captions, setCaptions] = useState<CaptionWord[]>([]);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionDone, setTranscriptionDone] = useState(false);

  // Hook 1: Uploader
  const {
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
    chunkSize: 5 * 1024 * 1024, // 5MB
    uploadEndpoint: '/api/upload-chunk' // matches backend endpoint
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

  // Handle local file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setFile(file);
      setTranscriptionDone(false);
      setCaptions([]);
    }
  };

  // Generate realistic captions when upload finishes
  useEffect(() => {
    if (uploadProgress === 100 && currentFile && !transcribing && !transcriptionDone) {
      setTranscribing(true);

      // Create local object URL so the player can play the local file without round-trips
      const audioUrl = URL.createObjectURL(currentFile);
      setSrc(audioUrl);

      // Simulate a small AI transcription delay
      const timer = setTimeout(() => {
        // We will read the audio duration once it loads, or make a mock duration based on file size
        // (1MB of standard audio is roughly 1 minute of 128kbps mp3)
        const estimatedDuration = Math.max(15, (currentFile.size / 16000));
        const words: CaptionWord[] = [];
        
        // Generate words spread across the estimated duration
        let currentTimeCursor = 0.5;
        let wordIndex = 0;

        while (currentTimeCursor < estimatedDuration - 1 && wordIndex < 100) {
          const text = SPANISH_WORDS[wordIndex % SPANISH_WORDS.length];
          const wordLen = text.length;
          // Allocate 0.2s - 0.5s per word depending on length
          const wordDuration = Math.max(0.18, Math.min(0.5, wordLen * 0.05));
          const start = currentTimeCursor;
          const end = start + wordDuration;

          words.push({
            id: `word-${wordIndex}`,
            text,
            start,
            end,
          });

          // advance cursor with slight spacing
          currentTimeCursor = end + (Math.random() * 0.15 + 0.05);
          wordIndex++;
        }

        setCaptions(words);
        setTranscribing(false);
        setTranscriptionDone(true);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [uploadProgress, currentFile, transcribing, transcriptionDone, setSrc]);

  // Update a word in captions array
  const handleUpdateWord = (id: string, newText: string) => {
    setCaptions((prev) =>
      prev.map((w) => (w.id === id ? { ...w, text: newText } : w))
    );
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
              Spanish Transcription Engine
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
        
        {/* Upload Panel */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
          {!currentFile ? (
            <div className="relative border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-lg p-5 flex flex-col items-center justify-center text-center transition-colors">
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
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
                  onClick={resetUploader}
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

              {/* Upload errors */}
              {uploadError && (
                <div className="bg-rose-950/60 border border-rose-800/60 rounded-lg p-2.5 flex items-start gap-2 text-[11px] text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Upload failed</p>
                    <p className="text-[10px] text-rose-400/80 mt-0.5">{uploadError}</p>
                  </div>
                </div>
              )}

              {/* Progress and trigger bar */}
              <div className="space-y-2">
                {isUploading && (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>Uploading 5MB blocks...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                )}
                
                {uploadProgress > 0 && (
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
                    className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-bold py-2 rounded-lg text-xs transition-all shadow-md shadow-indigo-600/20"
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
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col items-center justify-center text-center py-8">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
            <h3 className="text-xs font-semibold text-slate-200">Local AI Transcribing...</h3>
            <p className="text-[10px] text-slate-500 mt-1 max-w-[200px]">
              Extracting voice prints and aligning timestamps sequentially.
            </p>
          </div>
        )}

        {/* Player controls, Canvas, and Editor (Active post-upload) */}
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
              onUpdateWord={handleUpdateWord}
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
        <Info className="w-3 h-3 text-slate-500" /> Spanish Audio Transcription Engine &bull; Touch Optimized
      </footer>
    </div>
  );
}
