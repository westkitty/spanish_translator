import React, { useEffect, useRef, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { safePlayhead, selectVisibleWords } from '../lib/visibleWords';

export interface CaptionWord {
  id: string;
  text: string;
  start: number;
  end: number;
}

interface CaptionEditorProps {
  captions: CaptionWord[];
  currentTime: number;
  onUpdateWord: (id: string, text: string) => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  embedded?: boolean;
  audioAvailable?: boolean;
}

export function CaptionEditor({ captions, currentTime, onUpdateWord, onPause, onSeek, embedded = false, audioAvailable = true }: CaptionEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [windowSize, setWindowSize] = useState(25);
  const windowOffset = -8;
  const inputRef = useRef<HTMLInputElement | null>(null);

  const safeTime = safePlayhead(currentTime);
  const visibleStart = Math.max(0, safeTime + windowOffset);
  const visibleEnd = visibleStart + windowSize;
  const visibleWords = audioAvailable ? selectVisibleWords(captions, currentTime, windowSize, windowOffset) : captions;

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleWordClick = (word: CaptionWord) => {
    if (audioAvailable) {
      onPause();
      onSeek(word.start);
    }
    setEditingId(word.id);
    setEditValue(word.text);
  };

  const handleSave = (id: string) => {
    if (editValue.trim()) onUpdateWord(id, editValue.trim());
    setEditingId(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent, id: string) => {
    if (event.key === 'Enter') handleSave(id);
    else if (event.key === 'Escape') setEditingId(null);
  };

  return (
    <div className={embedded ? 'flex flex-col flex-grow min-h-[220px]' : 'flex flex-col glass rounded-2xl p-4 flex-grow min-h-[300px]'}>
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold tracking-wide" style={{ color: 'var(--text)' }}>INLINE TRANSCRIPT EDITOR</h2>
            <p className="text-[11px] mt-0.5 font-mono" style={{ color: 'var(--accent-bright)' }}>
              {audioAvailable ? `Active viewport: ${visibleStart.toFixed(1)}s – ${visibleEnd.toFixed(1)}s (${visibleWords.length} words)` : `${visibleWords.length} editable words`}
            </p>
          </div>
          {audioAvailable && (
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Viewport span:</label>
              <select value={windowSize} onChange={(event) => setWindowSize(Number(event.target.value))} className="bg-white/[0.06] border border-white/10 rounded px-2 py-0.5 text-xs font-mono focus:outline-none" style={{ color: 'var(--text)', borderColor: 'var(--accent-border)' }}>
                {[10, 20, 30, 45, 60].map((seconds) => <option key={seconds} value={seconds}>{seconds}s</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      <div className="flex-grow overflow-y-auto pr-1 space-y-4 select-text">
        {captions.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6" style={{ color: 'var(--text-subtle)' }}><p className="text-xs">No captions loaded.</p></div>
        ) : audioAvailable && visibleWords.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6" style={{ color: 'var(--text-subtle)' }}>
            <p className="text-xs">No words in this timeline segment.</p>
            <button type="button" onClick={() => onSeek(captions[0]?.start || 0)} className="mt-2 text-xs flex items-center gap-1 active:scale-95 transition-transform min-h-[44px] px-2" style={{ color: 'var(--accent-bright)' }}>
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Jump to first word
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-x-2 gap-y-3 leading-relaxed text-sm">
            {visibleWords.map((word) => {
              const isActive = audioAvailable && currentTime >= word.start && currentTime <= word.end;
              const isEditing = editingId === word.id;
              if (isEditing) {
                return (
                  <div key={word.id} className="inline-flex items-center rounded px-1.5 py-0.5 shadow-md animate-fade-in" style={{ background: 'var(--glass-bg-strong)', border: '1px solid var(--accent)' }}>
                    <input ref={inputRef} type="text" value={editValue} onChange={(event) => setEditValue(event.target.value)} onKeyDown={(event) => handleKeyDown(event, word.id)} aria-label={`Edit word ${word.text}`} className="bg-transparent text-xs font-medium focus:outline-none w-20 px-0.5" style={{ color: 'var(--text)' }} />
                    <button type="button" onClick={() => handleSave(word.id)} aria-label="Save edit" className="min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-90 transition-transform" style={{ color: 'var(--trans)' }}><Check className="w-3.5 h-3.5" aria-hidden="true" /></button>
                    <button type="button" onClick={() => setEditingId(null)} aria-label="Cancel edit" className="min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-90 transition-transform" style={{ color: '#fb7185' }}><X className="w-3.5 h-3.5" aria-hidden="true" /></button>
                  </div>
                );
              }
              return (
                <button key={word.id} type="button" onClick={() => handleWordClick(word)} className="caption-word-chip cursor-pointer px-1 py-0.5 rounded transition-all duration-200 select-none text-xs text-left" style={isActive ? { background: 'var(--accent-bg)', color: 'var(--accent-bright)', fontWeight: 700, border: '1px solid var(--accent-border)' } : { color: 'var(--text-muted)', background: 'var(--control-bg)', border: '1px solid var(--border)' }} title={audioAvailable ? `[${word.start.toFixed(2)}s – ${word.end.toFixed(2)}s] Edit word and seek` : 'Edit word'} aria-label={audioAvailable ? `Edit word ${word.text} at ${word.start.toFixed(2)} seconds` : `Edit word ${word.text}`}>
                  {word.text}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {captions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/10 text-[11px] text-center font-mono" style={{ color: 'var(--text-subtle)' }}>
          {audioAvailable ? 'Tap, click, or tab to a word to edit and seek. Only words near the playhead are shown.' : 'Tap, click, or tab to any word to edit it. All words are shown because no source audio is available.'}
        </div>
      )}
    </div>
  );
}
