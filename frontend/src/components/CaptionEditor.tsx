import React, { useState, useEffect, useRef } from 'react';
import { Check, X, RotateCcw } from 'lucide-react';
import { selectVisibleWords, safePlayhead } from '../lib/visibleWords';

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
  const [windowSize, setWindowSize] = useState(25);
  const windowOffset = -8;

  const inputRef = useRef<HTMLInputElement | null>(null);

  const safeTime = safePlayhead(currentTime);
  const visibleStart = Math.max(0, safeTime + windowOffset);
  const visibleEnd = visibleStart + windowSize;

  const visibleWords = selectVisibleWords(captions, currentTime, windowSize, windowOffset);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleWordClick = (word: CaptionWord) => {
    onPause();
    onSeek(word.start);
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
      {/* Header — only shown when not embedded */}
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold tracking-wide" style={{ color: 'var(--text)' }}>
              INLINE TRANSCRIPT EDITOR
            </h2>
            <p className="text-[11px] mt-0.5 font-mono" style={{ color: 'var(--accent-bright)' }}>
              Active Viewport: {visibleStart.toFixed(1)}s – {visibleEnd.toFixed(1)}s ({visibleWords.length} words)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Viewport span:</label>
            <select
              value={windowSize}
              onChange={(e) => setWindowSize(Number(e.target.value))}
              className="bg-white/[0.06] border border-white/10 rounded px-2 py-0.5 text-xs font-mono focus:outline-none"
              style={{ color: 'var(--text)', borderColor: 'var(--accent-border)' }}
            >
              <option value={10}>10s</option>
              <option value={20}>20s</option>
              <option value={30}>30s</option>
              <option value={45}>45s</option>
              <option value={60}>60s</option>
            </select>
          </div>
        </div>
      )}

      {/* Word grid */}
      <div className="flex-grow overflow-y-auto pr-1 space-y-4 select-text">
        {captions.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6" style={{ color: 'var(--text-subtle)' }}>
            <p className="text-xs">No captions loaded.</p>
            <p className="text-[11px] mt-1">Upload an audio file to generate or load captions.</p>
          </div>
        ) : visibleWords.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6" style={{ color: 'var(--text-subtle)' }}>
            <p className="text-xs">No words in this timeline segment.</p>
            <button
              onClick={() => onSeek(captions[0]?.start || 0)}
              className="mt-2 text-xs flex items-center gap-1 active:scale-95 transition-transform"
              style={{ color: 'var(--accent-bright)' }}
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
                    className="inline-flex items-center rounded px-1.5 py-0.5 shadow-md animate-fade-in"
                    style={{
                      background: 'rgba(2,8,23,0.7)',
                      border: '1px solid var(--accent)',
                    }}
                  >
                    <input
                      ref={inputRef}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, word.id)}
                      className="bg-transparent text-xs font-medium focus:outline-none w-20 px-0.5"
                      style={{ color: 'var(--text)' }}
                    />
                    {/* Check and X buttons have 44px touch targets via min dimensions */}
                    <button
                      onClick={() => handleSave(word.id)}
                      aria-label="Save edit"
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-90 transition-transform"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#34d399')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      aria-label="Cancel edit"
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-90 transition-transform"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#fb7185')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
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
                  className="cursor-pointer px-1 py-0.5 rounded transition-all duration-200 select-none text-xs"
                  style={
                    isActive
                      ? {
                          background: 'var(--accent-bg)',
                          color: '#bae6fd',
                          fontWeight: 700,
                          border: '1px solid var(--accent-border)',
                        }
                      : {
                          color: 'var(--text-muted)',
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }
                  }
                  title={`[${word.start.toFixed(2)}s – ${word.end.toFixed(2)}s] Click to edit`}
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
        <div className="mt-3 pt-3 border-t border-white/10 text-[11px] text-center font-mono" style={{ color: 'var(--text-subtle)' }}>
          Tap a word to edit and seek. Only words near the playhead are shown.
        </div>
      )}
    </div>
  );
}
