import { describe, it, expect } from 'vitest';
import { toTxt, toSrt, toVtt, toCsv, toBilingualSrt } from './exporters';
import type { CaptionWord } from '../components/CaptionEditor';
import type { Translation } from '../hooks/useTranscriber';

const words: CaptionWord[] = [
  { id: 'w0', text: 'hola', start: 0.0, end: 0.5 },
  { id: 'w1', text: 'mundo', start: 0.5, end: 1.0 },
  { id: 'w2', text: 'adiós', start: 2.0, end: 2.6 },
];

const translation: Translation = {
  text: 'hello world goodbye',
  segments: [
    { id: 's0', text: 'hello world', start: 0.0, end: 1.0 },
    { id: 's1', text: 'goodbye', start: 2.0, end: 2.6 },
  ],
};

describe('exporters', () => {
  it('toTxt includes both sections', () => {
    const out = toTxt({ words, translation });
    expect(out).toContain('=== Spanish Transcript ===\nhola mundo adiós');
    expect(out).toContain('=== English Translation ===\nhello world goodbye');
  });

  it('toSrt emits numbered cues with comma timestamps', () => {
    const out = toSrt({ words, translation });
    expect(out).toContain('1\n00:00:00,000 --> 00:00:01,000\nhello world');
    expect(out).toContain('2\n00:00:02,000 --> 00:00:02,600\ngoodbye');
  });

  it('toVtt starts with WEBVTT and uses dot timestamps', () => {
    const out = toVtt({ words, translation });
    expect(out.startsWith('WEBVTT')).toBe(true);
    expect(out).toContain('00:00:00.000 --> 00:00:01.000');
  });

  it('toBilingualSrt stacks Spanish over English', () => {
    const out = toBilingualSrt({ words, translation });
    expect(out).toContain('hola mundo\nhello world');
    expect(out).toContain('adiós\ngoodbye');
  });

  it('toCsv escapes and lists word timings', () => {
    const out = toCsv({ words, translation });
    expect(out.split('\n')[0]).toBe('text,start,end');
    expect(out).toContain('"hola",0.000,0.500');
  });

  it('removes spaces before punctuation in saved text and bilingual subtitles', () => {
    const punctuated = [
      { id: 'p0', text: 'hola', start: 0, end: 0.2 },
      { id: 'p1', text: ',', start: 0.2, end: 0.3 },
      { id: 'p2', text: 'mundo', start: 0.3, end: 0.7 },
      { id: 'p3', text: '!', start: 0.7, end: 0.8 },
    ];
    const translated = { text: 'hello world', segments: [{ id: 's', text: 'hello world', start: 0, end: 1 }] };
    expect(toTxt({ words: punctuated, translation: null })).toContain('hola, mundo!');
    expect(toBilingualSrt({ words: punctuated, translation: translated })).toContain('hola, mundo!\nhello world');
  });

  it('handles a missing translation gracefully', () => {
    expect(toSrt({ words, translation: null })).toBe('\n');
    expect(toTxt({ words, translation: null })).not.toContain('English');
  });
});
