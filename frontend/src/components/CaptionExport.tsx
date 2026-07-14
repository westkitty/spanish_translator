import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Clipboard, FileText, Languages } from 'lucide-react';
import type { CaptionWord } from './CaptionEditor';
import type { Translation } from '../hooks/useTranscriber';
import { EXPORT_FORMATS, type ExportFormat } from '../lib/exporters';
import { saveTextFile } from '../lib/fileSave';
import { notify } from '../lib/toast';
import { formatTranscriptText } from '../lib/uiState';

interface TranscriptExportProps {
  captions: CaptionWord[];
  translation?: Translation | null;
  fileName?: string;
}

export function CaptionExport({ captions, translation, fileName = 'transcript' }: TranscriptExportProps) {
  const [copied, setCopied] = useState<'spanish' | 'english' | null>(null);
  const clearCopiedTimerRef = useRef<number | null>(null);
  useEffect(() => () => { if (clearCopiedTimerRef.current !== null) window.clearTimeout(clearCopiedTimerRef.current); }, []);
  const disabled = captions.length === 0;
  const spanish = formatTranscriptText(captions);
  const english = translation?.text.trim() ?? '';
  const input = { words: captions, translation: translation ?? null };

  const copy = async (language: 'spanish' | 'english') => {
    const text = language === 'spanish' ? spanish : english;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(language);
      notify(`Copied ${language} text`, 'success');
      if (clearCopiedTimerRef.current !== null) window.clearTimeout(clearCopiedTimerRef.current);
      clearCopiedTimerRef.current = window.setTimeout(() => setCopied(null), 1800);
    } catch {
      notify(`Could not copy ${language} text`, 'error');
    }
  };

  const save = async (format: ExportFormat) => {
    if (disabled) return;
    const safeName = fileName.replace(/\.[^/.]+$/, '');
    const outputName = `${safeName}.${format.extension}`;
    try {
      await saveTextFile(outputName, format.mime, format.build(input));
      notify(`Saved ${outputName}`, 'success');
    } catch {
      notify(`Could not save ${outputName}`, 'error');
    }
  };

  const textFormat = EXPORT_FORMATS.find((format) => format.id === 'txt') ?? EXPORT_FORMATS[0];
  const specialistFormats = EXPORT_FORMATS.filter((format) => format.id !== textFormat.id);

  return (
    <section className="result-section export-section" aria-labelledby="export-heading">
      <div className="section-heading">
        <FileText aria-hidden="true" />
        <div><h2 id="export-heading">Copy or save</h2><p>Common actions first; subtitle and data formats are below.</p></div>
      </div>

      <div className="primary-export-grid">
        <button type="button" onClick={() => void copy('english')} disabled={!english}>
          {copied === 'english' ? <Check aria-hidden="true" /> : <Languages aria-hidden="true" />}
          {copied === 'english' ? 'English copied' : 'Copy English'}
        </button>
        <button type="button" onClick={() => void copy('spanish')} disabled={!spanish}>
          {copied === 'spanish' ? <Check aria-hidden="true" /> : <Clipboard aria-hidden="true" />}
          {copied === 'spanish' ? 'Spanish copied' : 'Copy Spanish'}
        </button>
        <button type="button" onClick={() => void save(textFormat)} disabled={disabled}>
          <FileText aria-hidden="true" /> Save / share text
        </button>
      </div>

      <details className="more-exports">
        <summary>More export formats <ChevronDown aria-hidden="true" /></summary>
        <div className="format-grid">
          {specialistFormats.map((format) => (
            <button key={format.id} type="button" onClick={() => void save(format)} disabled={disabled}>
              <strong>{format.label}</strong><span>.{format.extension}</span>
            </button>
          ))}
        </div>
      </details>
    </section>
  );
}
