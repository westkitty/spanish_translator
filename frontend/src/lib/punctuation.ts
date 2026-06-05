// Groups word-level transcripts into readable sentences/paragraphs by detecting
// natural pauses (gaps between words). Word-level Whisper output has no
// punctuation; this restores sentence breaks and capitalization so the "Read"
// view is comfortable to read. Pure + deterministic.

import type { CaptionWord } from '../components/CaptionEditor';

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

export function buildSentences(words: CaptionWord[], gapSec = 0.6): Sentence[] {
  const sentences: Sentence[] = [];
  let current: CaptionWord[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const raw = current.map((w) => w.text).join(' ').trim();
    let text = capitalize(raw);
    if (!SENTENCE_END.test(text)) text += '.';
    sentences.push({
      id: `sent-${sentences.length}`,
      text,
      start: current[0].start,
      end: current[current.length - 1].end,
      words: current,
    });
    current = [];
  };

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (i > 0) {
      const gap = w.start - words[i - 1].end;
      const prevEndsSentence = SENTENCE_END.test(words[i - 1].text);
      if (gap >= gapSec || prevEndsSentence) flush();
    }
    current.push(w);
  }
  flush();

  return sentences;
}
