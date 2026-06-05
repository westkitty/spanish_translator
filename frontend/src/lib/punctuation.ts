// Groups word-level transcripts into readable sentences/paragraphs by detecting
// natural pauses (gaps between words). Word-level Whisper output has no
// punctuation; this restores sentence breaks and capitalization so the "Read"
// view is comfortable to read. Pure + deterministic.

import type { CaptionWord } from '../components/CaptionEditor';
import { segmentByGaps, type SilenceRange } from './vad';
import { restoreInvertedMarks } from './spanishPunctuation';

export interface Sentence {
  id: string;
  text: string;
  start: number;
  end: number;
  words: CaptionWord[];
}

const SENTENCE_END = /[.!?…]$/;

function capitalize(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

export function buildSentences(
  words: CaptionWord[],
  silencesOrGap: SilenceRange[] | number = [],
  gapSec = 0.6
): Sentence[] {
  const silences = Array.isArray(silencesOrGap) ? silencesOrGap : [];
  const effectiveGapSec = typeof silencesOrGap === 'number' ? silencesOrGap : gapSec;
  const sentences: Sentence[] = [];
  let current: CaptionWord[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const raw = current.map((w) => w.text).join(' ').trim();
    let text = capitalize(raw);
    if (!SENTENCE_END.test(text)) text += '.';
    // Restore the Spanish opening mark (¿/¡) that Whisper omits.
    text = restoreInvertedMarks(text);
    sentences.push({
      id: `sent-${sentences.length}`,
      text,
      start: current[0].start,
      end: current[current.length - 1].end,
      words: current,
    });
    current = [];
  };

  const groups = silences.length > 0 ? segmentByGaps(words, silences) : [words];

  for (const group of groups) {
    for (let i = 0; i < group.length; i++) {
      const w = group[i];
      if (i > 0) {
        const gap = w.start - group[i - 1].end;
        const prevEndsSentence = SENTENCE_END.test(group[i - 1].text);
        if (gap >= effectiveGapSec || prevEndsSentence) flush();
      }
      current.push(w);
    }
    flush();
  }

  return sentences;
}
