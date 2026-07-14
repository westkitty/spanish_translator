import { useEffect, useMemo, useRef, useState } from 'react';
import { AlignLeft, Download, History, Redo2, Search, Type, Undo2 } from 'lucide-react';
import { CaptionEditor, type CaptionWord } from './CaptionEditor';
import { buildSentences, type Sentence } from '../lib/punctuation';
import type { SilenceRange } from '../lib/vad';

interface TranscriptViewProps {
  captions: CaptionWord[];
  currentTime: number;
  onUpdateWord: (id: string, text: string) => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onReplaceAll: (find: string, replace: string) => number;
  onUndo: () => void;
  onRedo: () => void;
  onRevert: () => void;
  canUndo: boolean;
  canRedo: boolean;
  canRevert: boolean;
  silences?: SilenceRange[];
  onExportClip?: (sentence: Sentence) => Promise<void> | void;
  audioAvailable?: boolean;
}

export function TranscriptView({ captions, currentTime, onUpdateWord, onPause, onSeek, onReplaceAll, onUndo, onRedo, onRevert, canUndo, canRedo, canRevert, silences = [], onExportClip, audioAvailable = true }: TranscriptViewProps) {
  const [mode, setMode] = useState<'words' | 'read'>('read');
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [lastCount, setLastCount] = useState<number | null>(null);
  const [followPlayhead, setFollowPlayhead] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const activeSentenceRef = useRef<HTMLButtonElement | null>(null);
  const sentences = useMemo(() => buildSentences(captions, silences), [captions, silences]);
  const activeSentenceId = audioAvailable ? sentences.find((sentence) => currentTime >= sentence.start && currentTime <= sentence.end)?.id ?? null : null;

  useEffect(() => {
    if (audioAvailable && mode === 'read' && followPlayhead && activeSentenceId) {
      activeSentenceRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }, [activeSentenceId, audioAvailable, followPlayhead, mode]);

  const exportClip = async (sentence: Sentence) => {
    if (!onExportClip || exportingId) return;
    setExportingId(sentence.id);
    try { await onExportClip(sentence); } finally { setExportingId(null); }
  };

  return (
    <section className="result-section transcript-section" aria-labelledby="transcript-heading">
      <div className="section-heading section-heading--stackable">
        <div>
          <h2 id="transcript-heading">Spanish transcript</h2>
          <p>{mode === 'read' ? (audioAvailable ? 'Read and seek by sentence.' : 'Read the complete saved transcript.') : 'Edit individual transcript words.'}</p>
        </div>
        <div className="segmented-control" role="group" aria-label="Transcript view">
          <button type="button" onClick={() => setMode('read')} aria-pressed={mode === 'read'}><AlignLeft aria-hidden="true" /> Read</button>
          <button type="button" onClick={() => setMode('words')} aria-pressed={mode === 'words'}><Type aria-hidden="true" /> Edit words</button>
        </div>
      </div>

      {mode === 'read' ? (
        <>
          {audioAvailable && <button type="button" className="compact-toggle mb-3" onClick={() => setFollowPlayhead((value) => !value)} aria-pressed={followPlayhead}>{followPlayhead ? 'Following audio' : 'Follow off'}</button>}
          <div className="sentence-list">
            {sentences.length === 0 ? <div className="empty-state empty-state--compact"><p>No transcript yet.</p></div> : sentences.map((sentence) => {
              const active = audioAvailable && currentTime >= sentence.start && currentTime <= sentence.end;
              return (
                <div key={sentence.id} className="sentence-row" data-active={active}>
                  {audioAvailable ? (
                    <button ref={active ? activeSentenceRef : undefined} type="button" onClick={() => onSeek(sentence.start)} className="sentence-row__seek" aria-label={`Seek to ${sentence.start.toFixed(1)} seconds: ${sentence.text}`}>{sentence.text}</button>
                  ) : <p className="sentence-row__text">{sentence.text}</p>}
                  {audioAvailable && onExportClip && (
                    <button type="button" onClick={() => void exportClip(sentence)} disabled={exportingId !== null} className="sentence-row__clip"><Download aria-hidden="true" /> {exportingId === sentence.id ? 'Exporting…' : 'Export clip'}</button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <CaptionEditor captions={captions} currentTime={currentTime} onUpdateWord={onUpdateWord} onPause={onPause} onSeek={onSeek} embedded audioAvailable={audioAvailable} />
      )}

      <details className="editor-tools">
        <summary>Editing tools</summary>
        <div className="editor-tools__body">
          <div className="toolbar-actions" aria-label="Transcript history controls">
            <button type="button" onClick={onUndo} disabled={!canUndo}><Undo2 aria-hidden="true" /> Undo</button>
            <button type="button" onClick={onRedo} disabled={!canRedo}><Redo2 aria-hidden="true" /> Redo</button>
            <button type="button" onClick={onRevert} disabled={!canRevert}><History aria-hidden="true" /> Revert</button>
          </div>
          <div className="find-replace">
            <Search aria-hidden="true" />
            <label><span>Find</span><input value={find} onChange={(event) => setFind(event.target.value)} /></label>
            <label><span>Replace with</span><input value={replace} onChange={(event) => setReplace(event.target.value)} /></label>
            <button type="button" disabled={!find} onClick={() => setLastCount(onReplaceAll(find, replace))}>Replace all</button>
          </div>
          {lastCount !== null && <p className="field-help" aria-live="polite">{lastCount === 0 ? 'No matches found.' : `Replaced ${lastCount} occurrence${lastCount === 1 ? '' : 's'}.`}</p>}
        </div>
      </details>
    </section>
  );
}
