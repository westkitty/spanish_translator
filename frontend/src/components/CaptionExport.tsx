import { useState } from 'react';
import { FileText, Captions, Code, Table, Languages, Clipboard, Check } from 'lucide-react';
import { CaptionWord } from './CaptionEditor';
import type { Translation } from '../hooks/useTranscriber';
import { EXPORT_FORMATS, toTxt, type ExportFormat } from '../lib/exporters';
import { saveTextFile } from '../lib/fileSave';
import { notify } from '../lib/toast';

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

  const handleExport = async (fmt: ExportFormat) => {
    if (disabled) return;
    const safeName = fileName.replace(/\.[^/.]+$/, '');
    const outputName = `${safeName}.${fmt.extension}`;
    try {
      await saveTextFile(outputName, fmt.mime, fmt.build(input));
      notify(`Saved ${outputName}`, 'success');
    } catch (err) {
      console.error('Save failed:', err);
      notify(`Could not save ${outputName}`, 'error');
    }
  };

  const handleCopy = async () => {
    if (disabled) return;
    try {
      await navigator.clipboard.writeText(toTxt(input));
      setCopied(true);
      notify('Copied transcript and translation', 'success');
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      notify('Could not copy transcript', 'error');
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
              type="button"
              onClick={() => void handleExport(fmt)}
              disabled={disabled}
              aria-label={`Save transcript as ${fmt.label} .${fmt.extension}`}
              className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl border text-[11px] font-medium transition-all duration-200 active:scale-95 min-h-[44px] ${
                disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:opacity-90'
              }`}
              style={
                disabled
                  ? { background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)', color: 'var(--text-subtle)' }
                  : { background: 'var(--accent-bg)', borderColor: 'var(--accent-border)', color: 'var(--accent-bright)' }
              }
              title={`.${fmt.extension}`}
            >
              <Icon className="w-5 h-5 mb-1.5" aria-hidden="true" />
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
        type="button"
        onClick={() => void handleCopy()}
        disabled={disabled}
        aria-label="Copy transcript and translation to clipboard"
        className={`mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[11px] font-medium transition-all duration-200 active:scale-95 min-h-[44px] ${
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        }`}
        style={
          disabled
            ? { background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)', color: 'var(--text-subtle)' }
            : copied
            ? { background: 'var(--trans-bg)', borderColor: 'var(--trans-border)', color: 'var(--trans-text)' }
            : { background: 'rgba(255,255,255,0.04)', borderColor: 'var(--border)', color: 'var(--text)' }
        }
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" aria-hidden="true" /> Copied to clipboard!
          </>
        ) : (
          <>
            <Clipboard className="w-4 h-4" aria-hidden="true" /> Copy transcript + translation
          </>
        )}
      </button>
    </div>
  );
}
