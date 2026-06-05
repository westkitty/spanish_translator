import { describe, it, expect } from 'vitest';
import {
  normalizeForScoring,
  tokenize,
  editDistance,
  wer,
  cer,
  scoreTranscript,
} from './wer';

describe('normalizeForScoring', () => {
  it('lowercases, strips punctuation, collapses whitespace', () => {
    expect(normalizeForScoring('  ¿Qué  tal,  amigo? ')).toBe('qué tal amigo');
  });
  it('keeps Spanish diacritics by default', () => {
    expect(normalizeForScoring('Año Niño')).toBe('año niño');
  });
  it('can fold diacritics when asked', () => {
    expect(normalizeForScoring('Año Niño', { foldDiacritics: true })).toBe('ano nino');
  });
});

describe('tokenize', () => {
  it('splits on whitespace after normalization', () => {
    expect(tokenize('Hola,  mundo!')).toEqual(['hola', 'mundo']);
  });
  it('returns empty array for empty/blank input', () => {
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('editDistance', () => {
  it('is zero for identical sequences', () => {
    expect(editDistance(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(0);
  });
  it('counts a single substitution', () => {
    expect(editDistance(['a', 'b', 'c'], ['a', 'x', 'c'])).toBe(1);
  });
  it('counts insertions and deletions', () => {
    expect(editDistance(['a', 'b'], ['a', 'b', 'c'])).toBe(1); // insertion
    expect(editDistance(['a', 'b', 'c'], ['a', 'c'])).toBe(1); // deletion
  });
});

describe('wer', () => {
  it('is 0 for a perfect match', () => {
    expect(wer('el gato come pescado', 'el gato come pescado').wer).toBe(0);
  });
  it('computes 1 substitution in 4 words = 0.25', () => {
    const r = wer('el gato come pescado', 'el perro come pescado');
    expect(r.wer).toBeCloseTo(0.25, 5);
    expect(r.substitutions).toBe(1);
    expect(r.refLength).toBe(4);
  });
  it('ignores punctuation and case by default', () => {
    expect(wer('El gato, come pescado.', 'el gato come pescado').wer).toBe(0);
  });
  it('handles empty hypothesis as all deletions', () => {
    const r = wer('uno dos tres', '');
    expect(r.deletions).toBe(3);
    expect(r.wer).toBe(1);
  });
});

describe('cer', () => {
  it('is 0 for identical strings', () => {
    expect(cer('hola', 'hola').cer).toBe(0);
  });
  it('catches a diacritic error that WER tokenization also catches', () => {
    // "ano" vs "año": 1 char substitution over 3 chars
    const r = cer('año', 'ano');
    expect(r.cer).toBeCloseTo(1 / 3, 5);
  });
});

describe('scoreTranscript', () => {
  it('returns both WER and CER together', () => {
    const s = scoreTranscript('el gato come pescado', 'el perro come pescado');
    expect(s.wer).toBeCloseTo(0.25, 5);
    expect(s.cer).toBeGreaterThan(0);
    expect(s.refWords).toBe(4);
  });
});
