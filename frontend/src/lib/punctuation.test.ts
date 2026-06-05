import { describe, it, expect } from 'vitest';
import { buildSentences } from './punctuation';
import type { CaptionWord } from '../components/CaptionEditor';

const w = (text: string, start: number, end: number): CaptionWord => ({
  id: `${start}`,
  text,
  start,
  end,
});

describe('buildSentences', () => {
  it('splits on pauses and capitalizes + punctuates', () => {
    const words = [
      w('hola', 0, 0.4),
      w('mundo', 0.45, 0.9), // small gap -> same sentence
      w('adiós', 2.0, 2.5), // 1.1s gap -> new sentence
    ];
    const sentences = buildSentences(words, 0.6);
    expect(sentences).toHaveLength(2);
    expect(sentences[0].text).toBe('Hola mundo.');
    expect(sentences[1].text).toBe('Adiós.');
    expect(sentences[0].start).toBe(0);
    expect(sentences[0].end).toBe(0.9);
  });

  it('keeps existing terminal punctuation', () => {
    const sentences = buildSentences([w('¿qué?', 0, 0.5), w('bien', 2, 2.4)], 0.6);
    expect(sentences[0].text).toBe('¿qué?');
  });

  it('returns empty for no words', () => {
    expect(buildSentences([])).toEqual([]);
  });
});
