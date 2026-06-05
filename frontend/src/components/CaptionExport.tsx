import { useState } from 'react';
import { FileText, Captions, Code, Table, Languages, Clipboard, Check } from 'lucide-react';
import { CaptionWord } from './CaptionEditor';
import type { Translation } from '../hooks/useTranscriber';
import { EXPORT_FORMATS, toTxt, type ExportFormat } from '../lib/exporters';

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

  const triggerDownload = (content: string, mime: string, extension: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = fileName.replace(/\.[^/.]+$/, '');
    link.download = `${safeName}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = (fmt: ExportFormat) => {
    if (disabled) return;
    triggerDownload(fmt.build(input), fmt.mime, fmt.extension);
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
      <h3 className="text-xs font-semibold tracking-wide text-slate-300 mb-1 uppercase">Save your transcript</h3>
      <p className="text-[10px] text-slate-400 mb-3">Pick a format — subtitles for video, a spreadsheet for data, or plain text.</p>

      <div className="grid grid-cols-3 gap-2.5">
        {EXPORT_FORMATS.map((fmt) => {
          const Icon = ICONS[fmt.id] ?? FileText;
          return (
            <button
              key={fmt.id}
              onClick={() => handleExport(fmt)}
              disabled={disabled}
              className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl border text-[11px] font-medium transition-all duration-200 active:scale-95 cursor-pointer ${
                disabled
                  ? 'bg-white/[0.02] border-white/5 text-slate-600 cursor-not-allowed'
                  : 'bg-sky-500/10 border-sky-400/20 text-sky-200 hover:bg-sky-500/20 hover:border-sky-400/40'
              }`}
              title={`.${fmt.extension}`}
            >
              <Icon className="w-5 h-5 mb-1.5" />
              <span className="text-center leading-tight">{fmt.label}</span>
              <span className="text-[8px] text-slate-500 font-mono mt-0.5">.{fmt.extension}</span>
            </button>
          );
        })}
      </div>

      <button
        onClick={handleCopy}
        disabled={disabled}
        className={`mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[11px] font-medium transition-all duration-200 active:scale-95 cursor-pointer ${
          disabled
            ? 'bg-white/[0.02] border-white/5 text-slate-600 cursor-not-allowed'
            : copied
            ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-300'
            : 'bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/10'
        }`}
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
