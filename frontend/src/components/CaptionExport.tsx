import { useState } from 'react';
import { FileText, Code, Clipboard, Check } from 'lucide-react';
import { CaptionWord } from './CaptionEditor';
import type { Translation } from '../hooks/useTranscriber';

interface TranscriptExportProps {
  captions: CaptionWord[];
  translation?: Translation | null;
  fileName?: string;
}

export function CaptionExport({ captions, translation, fileName = 'transcript' }: TranscriptExportProps) {
  const [copied, setCopied] = useState(false);

  const spanishText = captions.map((w) => w.text).join(' ');
  const englishText = translation?.text ?? '';

  // Trigger file download
  const triggerDownload = (content: string, mimeType: string, extension: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Clean file name
    const safeName = fileName.replace(/\.[^/.]+$/, "");
    link.download = `${safeName}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const buildPlainText = () => {
    let content = `=== Spanish Transcript ===\n${spanishText}`;
    if (englishText) {
      content += `\n\n=== English Translation ===\n${englishText}`;
    }
    return content;
  };

  const handleExportTXT = () => {
    triggerDownload(buildPlainText(), 'text/plain;charset=utf-8', 'txt');
  };

  const handleExportJSON = () => {
    const payload = {
      meta: {
        exportedAt: new Date().toISOString(),
        totalWords: captions.length,
        hasTranslation: Boolean(translation),
      },
      transcript: {
        language: 'spanish',
        text: spanishText,
        words: captions.map((w) => ({ text: w.text, start: w.start, end: w.end })),
      },
      translation: translation
        ? {
            language: 'english',
            text: translation.text,
            segments: translation.segments.map((s) => ({
              text: s.text,
              start: s.start,
              end: s.end,
            })),
          }
        : null,
    };
    triggerDownload(JSON.stringify(payload, null, 2), 'application/json;charset=utf-8', 'json');
  };

  const handleCopyTranscript = async () => {
    if (captions.length === 0) return;
    try {
      await navigator.clipboard.writeText(buildPlainText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const disabled = captions.length === 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg w-full">
      <h3 className="text-xs font-semibold tracking-wide text-slate-400 mb-3 uppercase">
        Export Transcript
      </h3>

      <div className="grid grid-cols-3 gap-2.5">
        <button
          onClick={handleExportTXT}
          disabled={disabled}
          className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-lg border text-xs font-medium transition-all duration-200 active:scale-95 cursor-pointer ${
            disabled
              ? 'bg-slate-800/20 border-slate-800 text-slate-600 cursor-not-allowed'
              : 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/20 hover:border-indigo-400/50'
          }`}
        >
          <FileText className="w-5 h-5 mb-1.5" />
          <span>TXT Document</span>
        </button>

        <button
          onClick={handleExportJSON}
          disabled={disabled}
          className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-lg border text-xs font-medium transition-all duration-200 active:scale-95 cursor-pointer ${
            disabled
              ? 'bg-slate-800/20 border-slate-800 text-slate-600 cursor-not-allowed'
              : 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/20 hover:border-indigo-400/50'
          }`}
        >
          <Code className="w-5 h-5 mb-1.5" />
          <span>Timed JSON</span>
        </button>

        <button
          onClick={handleCopyTranscript}
          disabled={disabled}
          className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-lg border text-xs font-medium transition-all duration-200 active:scale-95 cursor-pointer ${
            disabled
              ? 'bg-slate-800/20 border-slate-800 text-slate-600 cursor-not-allowed'
              : copied
              ? 'bg-emerald-600/10 border-emerald-500/40 text-emerald-400'
              : 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/20 hover:border-indigo-400/50'
          }`}
        >
          {copied ? (
            <>
              <Check className="w-5 h-5 mb-1.5 text-emerald-400 animate-pulse" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Clipboard className="w-5 h-5 mb-1.5" />
              <span>Copy Text</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
