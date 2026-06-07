import { useState } from 'react';
import { FileText, Captions, Code, Table, Languages, Clipboard, Check } from 'lucide-react';
import { CaptionWord } from './CaptionEditor';
import type { Translation } from '../hooks/useTranscriber';
import { EXPORT_FORMATS, toTxt, type ExportFormat } from '../lib/exporters';
import { saveTextFile } from '../lib/fileSave';

interface TranscriptExportProps {
  captions: CaptionWord[];
  translation?: Translation | null;
  fileName?: string;
}

const ICONS: Record<string, typeof FileText> = {
  txt: FileText,
  srt: Captions,
  vtt: Captions,
  bilingual: Languages,
  csv: Table,
  json: Code,
};

export function CaptionExport({ captions, translation, fileName = 'transcript' }: TranscriptExportProps) {
  const [copied, setCopied] = useState(false);
  const disabled = captions.length === 0;
  const input = { words: captions, translation: translation ?? null };

  const handleExport = (fmt: ExportFormat) => {
    if (disabled) return;
    const safeName = fileName.replace(/\.[^/.]+$/, '');
    saveTextFile(`${safeName}.${fmt.extension}`, fmt.mime, fmt.build(input)).catch((err) =>
      console.error('Save failed:', err)
    );
  };

  const handleCopy = async () => {
    if (disabled) return;
    try {
      await navigator.clipboard.writeText(toTxt(input));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="glass rounded-2xl p-4 w-full">
      <h3 className="text-xs font-semibold tracking-wide mb-1 uppercase" style={{ color: 'var(--text-muted)' }}>
        Save your transcript
      </h3>
      <p className="text-[11px] mb-3" style={{ color: 'var(--text-subtle)' }}>
        Pick a format — subtitles for video, a spreadsheet for data, or plain text.
      </p>

      <div className="grid grid-cols-3 gap-2.5">
        {EXPORT_FORMATS.map((fmt) => {
          const Icon = ICONS[fmt.id] ?? FileText;
          return (
            <button
              key={fmt.id}
              onClick={() => handleExport(fmt)}
              disabled={disabled}
              className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl border text-[11px] font-medium transition-all duration-200 active:scale-95 cursor-pointer min-h-[44px] ${
                disabled
                  ? 'cursor-not-allowed'
                  : 'hover:opacity-90'
              }`}
              style={
                disabled
                  ? { background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)', color: 'var(--text-subtle)' }
                  : { background: 'var(--accent-bg)', borderColor: 'var(--accent-border)', color: '#bae6fd' }
              }
              title={`.${fmt.extension}`}
            >
              <Icon className="w-5 h-5 mb-1.5" />
              <span className="text-center leading-tight">{fmt.label}</span>
              {/* Extension label: min 11px so it's legible at tablet distance */}
              <span className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                .{fmt.extension}
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={handleCopy}
        disabled={disabled}
        className={`mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[11px] font-medium transition-all duration-200 active:scale-95 cursor-pointer min-h-[44px] ${
          disabled ? 'cursor-not-allowed' : ''
        }`}
        style={
          disabled
            ? { background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)', color: 'var(--text-subtle)' }
            : copied
            ? { background: 'var(--trans-bg)', borderColor: 'var(--trans-border)', color: '#a7f3d0' }
            : { background: 'rgba(255,255,255,0.04)', borderColor: 'var(--border)', color: 'var(--text)' }
        }
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" /> Copied to clipboard!
          </>
        ) : (
          <>
            <Clipboard className="w-4 h-4" /> Copy transcript + translation
          </>
        )}
      </button>
    </div>
  );
}
