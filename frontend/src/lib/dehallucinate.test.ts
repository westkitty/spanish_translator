import { describe, it, expect } from 'vitest';
import { collapseRepeatedPhrases } from './dehallucinate';

interface Item {
  text: string;
  start: number;
  end: number;
}
const it_ = (text: string, start: number): Item => ({ text, start, end: start + 1 });

describe('collapseRepeatedPhrases', () => {
  it('collapses a runaway single-word repeat to the cap', () => {
    const items = ['gracias', 'gracias', 'gracias', 'gracias', 'gracias'].map((t, i) => it_(t, i));
    const out = collapseRepeatedPhrases(items, { maxRepeats: 2 });
    expect(out.map((x) => x.text)).toEqual(['gracias', 'gracias']);
  });

  it('keeps legitimate short repeats within the cap', () => {
    const items = ['no', 'no'].map((t, i) => it_(t, i));
    const out = collapseRepeatedPhrases(items, { maxRepeats: 2 });
    expect(out.map((x) => x.text)).toEqual(['no', 'no']);
  });

  it('collapses a repeated multi-word phrase cycle', () => {
    const items = ['hola', 'y', 'entonces', 'y', 'entonces', 'y', 'entonces', 'fin'].map((t, i) =>
      it_(t, i)
    );
    const out = collapseRepeatedPhrases(items, { maxRepeats: 1, maxPhraseLen: 2 });
    expect(out.map((x) => x.text)).toEqual(['hola', 'y', 'entonces', 'fin']);
  });

  it('is case/punctuation insensitive when matching', () => {
    const items = ['Gracias.', 'gracias', 'GRACIAS', 'gracias'].map((t, i) => it_(t, i));
    const out = collapseRepeatedPhrases(items, { maxRepeats: 1 });
    expect(out.map((x) => x.text)).toEqual(['Gracias.']);
  });

  it('preserves timestamps of the kept items', () => {
    const items = [it_('a', 0), it_('a', 5), it_('a', 9)];
    const out = collapseRepeatedPhrases(items, { maxRepeats: 1 });
    expect(out).toEqual([it_('a', 0)]);
  });

  it('leaves non-repeating content untouched', () => {
    const items = ['el', 'gato', 'come', 'pescado'].map((t, i) => it_(t, i));
    const out = collapseRepeatedPhrases(items, { maxRepeats: 2 });
    expect(out.map((x) => x.text)).toEqual(['el', 'gato', 'come', 'pescado']);
  });
});
