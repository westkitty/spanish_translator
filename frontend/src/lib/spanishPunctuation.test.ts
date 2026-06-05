import { describe, it, expect } from 'vitest';
import { restoreInvertedMarks } from './spanishPunctuation';

describe('restoreInvertedMarks', () => {
  it('adds an opening ¿ to a question', () => {
    expect(restoreInvertedMarks('Qué hora es?')).toBe('¿Qué hora es?');
  });
  it('adds an opening ¡ to an exclamation', () => {
    expect(restoreInvertedMarks('Cuidado!')).toBe('¡Cuidado!');
  });
  it('is idempotent when the mark already exists', () => {
    expect(restoreInvertedMarks('¿qué?')).toBe('¿qué?');
    expect(restoreInvertedMarks('¡hola!')).toBe('¡hola!');
  });
  it('leaves declarative sentences untouched', () => {
    expect(restoreInvertedMarks('Hola mundo.')).toBe('Hola mundo.');
  });
  it('handles trailing whitespace and multiple terminal marks', () => {
    expect(restoreInvertedMarks('En serio?! ')).toBe('¿En serio?! ');
  });
  it('returns empty/blank input unchanged', () => {
    expect(restoreInvertedMarks('')).toBe('');
    expect(restoreInvertedMarks('   ')).toBe('   ');
  });
});
