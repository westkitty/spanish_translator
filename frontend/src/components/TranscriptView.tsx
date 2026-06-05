import { useMemo, useState } from 'react';
import { Type, AlignLeft, Search, Undo2, Redo2, History, Download } from 'lucide-react';
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
  onExportClip?: (sentence: Sentence) => void;
}

export function TranscriptView({
  captions,
  currentTime,
  onUpdateWord,
  onPause,
  onSeek,
  onReplaceAll,
  onUndo,
  onRedo,
  onRevert,
  canUndo,
  canRedo,
  canRevert,
  silences = [],
  onExportClip,
}: TranscriptViewProps) {
  const [mode, setMode] = useState<'words' | 'read'>('words');
  const [showFind, setShowFind] = useState(false);
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [lastCount, setLastCount] = useState<number | null>(null);

  const sentences = useMemo(() => buildSentences(captions, silences), [captions, silences]);

  const tabBtn = (active: boolean) =>
    `flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
      active ? 'bg-sky-500/20 text-sky-200 border border-sky-400/30' : 'text-slate-400 hover:text-white border border-transparent'
    }`;

  const iconBtn = (enabled: boolean) =>
    `p-1.5 rounded-lg transition-colors ${
      enabled ? 'text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer' : 'text-slate-700 cursor-not-allowed'
    }`;

  return (
    <div className="flex flex-col glass rounded-2xl p-4 flex-grow h-0 min-h-[320px]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-3 flex-wrap">
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5">
          <button onClick={() => setMode('words')} className={tabBtn(mode === 'words')}>
            <Type className="w-3.5 h-3.5" /> Edit words
          </button>
          <button onClick={() => setMode('read')} className={tabBtn(mode === 'read')}>
            <AlignLeft className="w-3.5 h-3.5" /> Read
          </button>
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          <button onClick={() => setShowFind((v) => !v)} className={iconBtn(true)} aria-label="Find and replace">
            <Search className="w-4 h-4" />
          </button>
          <button onClick={onUndo} disabled={!canUndo} className={iconBtn(canUndo)} aria-label="Undo">
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={onRedo} disabled={!canRedo} className={iconBtn(canRedo)} aria-label="Redo">
            <Redo2 className="w-4 h-4" />
          </button>
          <button onClick={onRevert} disabled={!canRevert} className={iconBtn(canRevert)} aria-label="Revert to original" title="Revert to original">
            <History className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Find & replace */}
      {showFind && (
        <div className="flex items-center gap-2 mb-3 animate-fade-in flex-wrap">
          <input
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder="Find"
            className="flex-1 min-w-[80px] bg-white/[0.04] text-slate-100 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:border-sky-400 focus:outline-none"
          />
          <input
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            placeholder="Replace with"
            className="flex-1 min-w-[80px] bg-white/[0.04] text-slate-100 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:border-sky-400 focus:outline-none"
          />
          <button
            onClick={() => find && setLastCount(onReplaceAll(find, replace))}
            className="bg-sky-500/20 text-sky-200 border border-sky-400/30 rounded-lg px-3 py-1.5 text-[11px] font-semibold hover:bg-sky-500/30 transition-colors cursor-pointer"
          >
            Replace all
          </button>
          {lastCount !== null && (
            <span className="text-[10px] text-slate-400 font-mono w-full">
              {lastCount === 0 ? 'No matches found' : `Replaced ${lastCount} occurrence${lastCount === 1 ? '' : 's'}`}
            </span>
          )}
        </div>
      )}

      {/* Body */}
      {mode === 'words' ? (
        <CaptionEditor
          captions={captions}
          currentTime={currentTime}
          onUpdateWord={onUpdateWord}
          onPause={onPause}
          onSeek={onSeek}
          embedded
        />
      ) : (
        <div className="flex-grow overflow-y-auto pr-1 space-y-3 select-text">
          {sentences.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No transcript yet.</p>
          ) : (
            sentences.map((s) => {
              const active = currentTime >= s.start && currentTime <= s.end;
              return (
                <div
                  key={s.id}
                  onClick={() => onSeek(s.start)}
                  className={`group cursor-pointer px-2.5 py-1.5 rounded-lg text-sm leading-relaxed transition-colors ${
                    active ? 'bg-sky-600/20 text-sky-100 border border-sky-400/30' : 'text-slate-300 hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  <p>{s.text}</p>
                  {onExportClip && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onExportClip(s);
                      }}
                      className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-sky-200 transition-colors cursor-pointer"
                    >
                      <Download className="w-3 h-3" /> Export clip
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
