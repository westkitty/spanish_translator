import React, { useState, useEffect, useRef } from 'react';
import { Check, X, RotateCcw } from 'lucide-react';

export interface CaptionWord {
  id: string;
  text: string;
  start: number; // in seconds
  end: number;   // in seconds
}

interface CaptionEditorProps {
  captions: CaptionWord[];
  currentTime: number;
  onUpdateWord: (id: string, text: string) => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  /** When true, render only the editor body (no outer glass card/header). */
  embedded?: boolean;
}

export function CaptionEditor({
  captions,
  currentTime,
  onUpdateWord,
  onPause,
  onSeek,
  embedded = false,
}: CaptionEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [windowSize, setWindowSize] = useState(25); // seconds of visible window
  const windowOffset = -8; // seconds before currentTime

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Time-based virtualization: Filter words within the active viewport
  const visibleStart = Math.max(0, currentTime + windowOffset);
  const visibleEnd = visibleStart + windowSize;

  const visibleWords = captions.filter(
    (w) => w.end >= visibleStart && w.start <= visibleEnd
  );

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleWordClick = (word: CaptionWord) => {
    onPause();
    onSeek(word.start); // Seek to the word's start time
    setEditingId(word.id);
    setEditValue(word.text);
  };

  const handleSave = (id: string) => {
    if (editValue.trim()) {
      onUpdateWord(id, editValue.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      handleSave(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  return (
    <div className={embedded ? 'flex flex-col flex-grow h-0 min-h-[220px]' : 'flex flex-col glass rounded-2xl p-4 flex-grow h-0 min-h-[300px]'}>
      {/* Header controls for virtualization configuration */}
      <div className={`flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-4 ${embedded ? 'hidden' : ''}`}>
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-slate-200">
            INLINE TRANSCRIPT EDITOR
          </h2>
          <p className="text-[10px] text-indigo-400 font-mono mt-0.5">
            Active Viewport: {visibleStart.toFixed(1)}s – {visibleEnd.toFixed(1)}s (Total visible: {visibleWords.length} words)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-slate-400 font-medium">Viewport span:</label>
          <select
            value={windowSize}
            onChange={(e) => setWindowSize(Number(e.target.value))}
            className="bg-slate-950 text-slate-300 border border-slate-700 rounded px-2 py-0.5 text-xs font-mono focus:border-indigo-500 focus:outline-none"
          >
            <option value={10}>10s</option>
            <option value={20}>20s</option>
            <option value={30}>30s</option>
            <option value={45}>45s</option>
            <option value={60}>60s</option>
          </select>
        </div>
      </div>

      {/* Editor Main Viewport */}
      <div className="flex-grow overflow-y-auto pr-1 space-y-4 select-text">
        {captions.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <p className="text-xs">No captions loaded.</p>
            <p className="text-[10px] mt-1">Upload an audio file to generate or load captions.</p>
          </div>
        ) : visibleWords.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <p className="text-xs">No words in this timeline segment.</p>
            <button
              onClick={() => onSeek(captions[0]?.start || 0)}
              className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 active:scale-95 transition-transform"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Jump to first word
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-x-2 gap-y-3 leading-relaxed text-sm">
            {visibleWords.map((word) => {
              const isActive = currentTime >= word.start && currentTime <= word.end;
              const isEditing = editingId === word.id;

              if (isEditing) {
                return (
                  <div
                    key={word.id}
                    className="inline-flex items-center bg-slate-950 border border-indigo-500/80 rounded px-1.5 py-0.5 shadow-md shadow-indigo-500/10 animate-fade-in"
                  >
                    <input
                      ref={inputRef}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, word.id)}
                      className="bg-transparent text-slate-100 text-xs font-medium focus:outline-none w-20 px-0.5"
                    />
                    <button
                      onClick={() => handleSave(word.id)}
                      className="p-0.5 hover:text-emerald-400 text-slate-400 active:scale-90 transition-transform ml-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-0.5 hover:text-rose-400 text-slate-400 active:scale-90 transition-transform ml-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              }

              return (
                <span
                  key={word.id}
                  onClick={() => handleWordClick(word)}
                  className={`cursor-pointer px-1 py-0.5 rounded transition-all duration-200 select-none text-xs ${
                    isActive
                      ? 'bg-indigo-600/90 text-white font-bold scale-105 shadow-md shadow-indigo-500/35 border border-indigo-400/40'
                      : 'text-slate-300 bg-slate-800/40 border border-slate-800/60 hover:bg-slate-800 hover:text-white'
                  }`}
                  title={`[${word.start.toFixed(2)}s - ${word.end.toFixed(2)}s] Click to edit`}
                >
                  {word.text}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer hint */}
      {captions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-800 text-[10px] text-slate-500 text-center font-mono">
          💡 Tap a word to edit & seek. Virtualized index hides out-of-bounds DOM nodes.
        </div>
      )}
    </div>
  );
}
