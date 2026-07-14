// Pure transcript exporters. Each takes the in-memory result and returns a
// string ready to save. Spanish words are word-level; the English translation
// is segment-level. Subtitle cues are built from the translation segment timing.

import { formatTimestamp } from './srt';
import type { CaptionWord } from '../components/CaptionEditor';
import type { Translation, TranslationSegment } from '../hooks/useTranscriber';
import { formatTranscriptText } from './uiState';

export interface ExportInput {
  words: CaptionWord[];
  translation: Translation | null;
}

function spanishText(words: CaptionWord[]): string {
  return formatTranscriptText(words);
}

function wordsInRange(words: CaptionWord[], start: number, end: number): string {
  return formatTranscriptText(words.filter((w) => w.end > start && w.start < end));
}

/** Plain text: Spanish transcript, then the English translation (if present). */
export function toTxt({ words, translation }: ExportInput): string {
  let out = `=== Spanish Transcript ===\n${spanishText(words)}`;
  if (translation?.text) {
    out += `\n\n=== English Translation ===\n${translation.text}`;
  }
  return out + '\n';
}

/** Build SRT/VTT from a list of timed segments. */
function cues(segments: TranslationSegment[], sep: ',' | '.', text: (s: TranslationSegment) => string): string[] {
  return segments.map(
    (s, i) =>
      `${i + 1}\n${formatTimestamp(s.start, sep)} --> ${formatTimestamp(s.end, sep)}\n${text(s)}`
  );
}

/** English subtitles (.srt) from translation segments. */
export function toSrt({ translation }: ExportInput): string {
  const segs = translation?.segments ?? [];
  return cues(segs, ',', (s) => s.text).join('\n\n') + '\n';
}

/** English subtitles (.vtt). */
export function toVtt({ translation }: ExportInput): string {
  const segs = translation?.segments ?? [];
  return 'WEBVTT\n\n' + cues(segs, '.', (s) => s.text).join('\n\n') + '\n';
}

/** Bilingual subtitles: Spanish line over English line, per cue. */
export function toBilingualSrt({ words, translation }: ExportInput): string {
  const segs = translation?.segments ?? [];
  return (
    cues(segs, ',', (s) => {
      const es = wordsInRange(words, s.start, s.end);
      return `${es}\n${s.text}`;
    }).join('\n\n') + '\n'
  );
}

/** CSV of word-level Spanish timings: text,start,end. */
export function toCsv({ words }: ExportInput): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = words.map((w) => `${esc(w.text)},${w.start.toFixed(3)},${w.end.toFixed(3)}`);
  return ['text,start,end', ...rows].join('\n') + '\n';
}

/** Structured JSON with both transcript and translation. */
export function toJson({ words, translation }: ExportInput): string {
  const payload = {
    meta: {
      exportedAt: new Date().toISOString(),
      totalWords: words.length,
      hasTranslation: Boolean(translation),
    },
    transcript: {
      language: 'spanish',
      text: spanishText(words),
      words: words.map((w) => ({ text: w.text, start: w.start, end: w.end })),
    },
    translation: translation
      ? {
          language: 'english',
          text: translation.text,
          segments: translation.segments.map((s) => ({ text: s.text, start: s.start, end: s.end })),
        }
      : null,
  };
  return JSON.stringify(payload, null, 2);
}

export interface ExportFormat {
  id: string;
  label: string;
  extension: string;
  mime: string;
  build: (input: ExportInput) => string;
}

export const EXPORT_FORMATS: ExportFormat[] = [
  { id: 'txt', label: 'Text', extension: 'txt', mime: 'text/plain;charset=utf-8', build: toTxt },
  { id: 'srt', label: 'Subtitles', extension: 'srt', mime: 'text/plain;charset=utf-8', build: toSrt },
  { id: 'vtt', label: 'Web Subtitles', extension: 'vtt', mime: 'text/vtt;charset=utf-8', build: toVtt },
  { id: 'bilingual', label: 'Bilingual Subs', extension: 'srt', mime: 'text/plain;charset=utf-8', build: toBilingualSrt },
  { id: 'csv', label: 'Spreadsheet', extension: 'csv', mime: 'text/csv;charset=utf-8', build: toCsv },
  { id: 'json', label: 'Timed JSON', extension: 'json', mime: 'application/json;charset=utf-8', build: toJson },
];
