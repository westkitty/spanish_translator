import { describe, it, expect } from 'vitest';
import {
  parseGlossary,
  applyGlossaryToText,
  applyGlossaryToWords,
  deriveGlossaryRules,
  mergeGlossaryText,
} from './glossary';

describe('parseGlossary', () => {
  it('parses arrow-mapped corrections', () => {
    expect(parseGlossary('watsap -> WhatsApp')).toEqual([{ from: 'watsap', to: 'WhatsApp' }]);
  });
  it('accepts =>, ->, and = separators', () => {
    const rules = parseGlossary('a => b\nc -> d\ne = f');
    expect(rules).toEqual([
      { from: 'a', to: 'b' },
      { from: 'c', to: 'd' },
      { from: 'e', to: 'f' },
    ]);
  });
  it('treats a bare term as a case-normalization rule (from === to)', () => {
    expect(parseGlossary('Becerra')).toEqual([{ from: 'Becerra', to: 'Becerra' }]);
  });
  it('supports multi-word phrases and ignores blank lines/comments', () => {
    const rules = parseGlossary('  \n# a comment\nnueva york -> Nueva York\n');
    expect(rules).toEqual([{ from: 'nueva york', to: 'Nueva York' }]);
  });
  it('returns [] for empty input', () => {
    expect(parseGlossary('')).toEqual([]);
    expect(parseGlossary('   ')).toEqual([]);
  });
});

describe('applyGlossaryToText', () => {
  it('replaces case-insensitively at word boundaries', () => {
    const rules = parseGlossary('watsap -> WhatsApp');
    expect(applyGlossaryToText('Mandé un watsap y otro Watsap', rules)).toBe(
      'Mandé un WhatsApp y otro WhatsApp'
    );
  });
  it('does not replace inside larger words', () => {
    const rules = parseGlossary('ana -> Ana');
    expect(applyGlossaryToText('banana ananá', rules)).toBe('banana ananá');
  });
  it('normalizes casing for a bare-term rule', () => {
    const rules = parseGlossary('José');
    expect(applyGlossaryToText('hablé con jose ayer', rules)).toBe('hablé con José ayer');
  });
  it('handles multi-word phrases', () => {
    const rules = parseGlossary('nueva york -> Nueva York');
    expect(applyGlossaryToText('vivo en nueva york', rules)).toBe('vivo en Nueva York');
  });
});

interface W {
  id: string;
  text: string;
  start: number;
  end: number;
}
const w = (text: string, start: number, end: number, id = text): W => ({ id, text, start, end });

describe('applyGlossaryToWords', () => {
  it('replaces a single token in place, keeping timestamps', () => {
    const rules = parseGlossary('jose -> José');
    const out = applyGlossaryToWords([w('Hola', 0, 1), w('jose', 1, 2)], rules);
    expect(out.map((x) => x.text)).toEqual(['Hola', 'José']);
    expect(out[1].start).toBe(1);
    expect(out[1].end).toBe(2);
  });
  it('collapses a multi-word phrase into one corrected token spanning the range', () => {
    const rules = parseGlossary('nueva york -> Nueva York');
    const out = applyGlossaryToWords(
      [w('en', 0, 1), w('nueva', 1, 2), w('york', 2, 3)],
      rules
    );
    expect(out.map((x) => x.text)).toEqual(['en', 'Nueva York']);
    expect(out[1].start).toBe(1);
    expect(out[1].end).toBe(3);
  });
  it('strips surrounding punctuation when matching but preserves it', () => {
    const rules = parseGlossary('jose -> José');
    const out = applyGlossaryToWords([w('¡jose!', 0, 1)], rules);
    expect(out[0].text).toBe('¡José!');
  });
  it('leaves words untouched when no rule matches', () => {
    const rules = parseGlossary('xyz -> ZYX');
    const words = [w('hola', 0, 1), w('mundo', 1, 2)];
    expect(applyGlossaryToWords(words, rules).map((x) => x.text)).toEqual(['hola', 'mundo']);
  });
  it('is a no-op for empty rules', () => {
    const words = [w('a', 0, 1)];
    expect(applyGlossaryToWords(words, [])).toEqual(words);
  });
});

describe('deriveGlossaryRules', () => {
  it('derives a rule from an edited word (matched by id)', () => {
    const original = [w('Hola', 0, 1, 'a'), w('watsap', 1, 2, 'b')];
    const edited = [w('Hola', 0, 1, 'a'), w('WhatsApp', 1, 2, 'b')];
    expect(deriveGlossaryRules(original, edited)).toEqual([{ from: 'watsap', to: 'WhatsApp' }]);
  });
  it('ignores edits that only change case/diacritics of the same word', () => {
    // "jose" -> "José" IS a meaningful correction (different surface form).
    const original = [w('jose', 0, 1, 'a')];
    const edited = [w('José', 0, 1, 'a')];
    expect(deriveGlossaryRules(original, edited)).toEqual([{ from: 'jose', to: 'José' }]);
  });
  it('skips unchanged words and dedupes repeated corrections', () => {
    const original = [w('x', 0, 1, 'a'), w('x', 1, 2, 'b'), w('y', 2, 3, 'c')];
    const edited = [w('z', 0, 1, 'a'), w('z', 1, 2, 'b'), w('y', 2, 3, 'c')];
    expect(deriveGlossaryRules(original, edited)).toEqual([{ from: 'x', to: 'z' }]);
  });
});

describe('mergeGlossaryText', () => {
  it('appends new rules not already present', () => {
    const merged = mergeGlossaryText('jose -> José', [{ from: 'watsap', to: 'WhatsApp' }]);
    expect(merged).toBe('jose -> José\nwatsap -> WhatsApp');
  });
  it('does not duplicate an existing from-key', () => {
    const merged = mergeGlossaryText('watsap -> WhatsApp', [{ from: 'watsap', to: 'Whatsapp' }]);
    expect(merged).toBe('watsap -> WhatsApp');
  });
  it('handles empty existing text', () => {
    expect(mergeGlossaryText('', [{ from: 'a', to: 'b' }])).toBe('a -> b');
  });
});
