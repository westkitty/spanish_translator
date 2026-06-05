// User glossary — the *working* replacement for the old "vocabulary hint".
//
// Whisper's `prompt`/`initial_prompt` is silently ignored by Transformers.js
// (issues #1028 / #923), so the previous "names & words to expect" box did
// nothing. This module instead performs deterministic post-decode correction:
// the user lists fixes (`watsap -> WhatsApp`) or bare proper nouns (`José`), and
// we apply them to the finished transcript — case-insensitive and
// diacritic-insensitive on the *match* side, exact on the *replacement* side.
//
// Pure and unit-tested; no model, DOM, or network.

export interface GlossaryRule {
  from: string;
  to: string;
}

const SEPARATOR = /\s*(?:=>|->|=)\s*/;

/** Parse glossary text. Each non-blank, non-`#` line is either `from -> to`
 *  (or `=>`/`=`) or a bare term, which becomes a case/diacritic-normalization
 *  rule (from === to). */
export function parseGlossary(text: string): GlossaryRule[] {
  const rules: GlossaryRule[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (SEPARATOR.test(line)) {
      const [from, ...rest] = line.split(SEPARATOR);
      const to = rest.join('').trim();
      if (from.trim() && to) rules.push({ from: from.trim(), to });
    } else {
      rules.push({ from: line, to: line });
    }
  }
  return rules;
}

/** Lowercase + strip diacritics — the key both sides are compared on. */
function foldKey(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

interface Affixed {
  prefix: string; // leading punctuation
  core: string; // the word itself
  suffix: string; // trailing punctuation
}

const AFFIX_RE = /^([^\p{L}\p{N}]*)([\s\S]*?)([^\p{L}\p{N}]*)$/u;

function splitAffixes(token: string): Affixed {
  const m = token.match(AFFIX_RE);
  if (!m) return { prefix: '', core: token, suffix: '' };
  return { prefix: m[1] ?? '', core: m[2] ?? '', suffix: m[3] ?? '' };
}

interface Replacement {
  start: number;
  length: number;
  to: string;
}

/** Find non-overlapping rule matches over a list of word cores. Rules are tried
 *  in order; within a rule, left-to-right. */
function planReplacements(cores: string[], rules: GlossaryRule[]): Replacement[] {
  const folded = cores.map(foldKey);
  const used = new Array(cores.length).fill(false);
  const reps: Replacement[] = [];

  for (const rule of rules) {
    const fromTokens = rule.from.trim().split(/\s+/).map(foldKey);
    const k = fromTokens.length;
    if (k === 0) continue;
    for (let i = 0; i + k <= cores.length; i++) {
      let free = true;
      for (let j = 0; j < k; j++) if (used[i + j]) { free = false; break; }
      if (!free) continue;
      let match = true;
      for (let j = 0; j < k; j++) if (folded[i + j] !== fromTokens[j]) { match = false; break; }
      if (match) {
        reps.push({ start: i, length: k, to: rule.to });
        for (let j = 0; j < k; j++) used[i + j] = true;
      }
    }
  }
  reps.sort((a, b) => a.start - b.start);
  return reps;
}

/** Apply glossary rules to a plain string. Whitespace is normalized to single
 *  spaces. Surrounding punctuation on a matched token is preserved. */
export function applyGlossaryToText(text: string, rules: GlossaryRule[]): string {
  if (rules.length === 0) return text;
  const tokens = text.split(/\s+/).filter(Boolean).map(splitAffixes);
  const cores = tokens.map((t) => t.core);
  const reps = planReplacements(cores, rules);

  const out: string[] = [];
  let i = 0;
  let r = 0;
  while (i < tokens.length) {
    if (r < reps.length && reps[r].start === i) {
      const rep = reps[r];
      const first = tokens[i];
      const last = tokens[i + rep.length - 1];
      out.push(first.prefix + rep.to + last.suffix);
      i += rep.length;
      r++;
    } else {
      const t = tokens[i];
      out.push(t.prefix + t.core + t.suffix);
      i++;
    }
  }
  return out.join(' ');
}

interface TimedWord {
  text: string;
  start: number;
  end: number;
}

/** Apply glossary rules to a timestamped word array. Single-token matches are
 *  replaced in place; multi-word phrases collapse into one word spanning the
 *  matched time range. Surrounding punctuation is preserved. */
export function applyGlossaryToWords<T extends TimedWord>(words: T[], rules: GlossaryRule[]): T[] {
  if (rules.length === 0) return words;
  const tokens = words.map((w) => splitAffixes(w.text));
  const cores = tokens.map((t) => t.core);
  const reps = planReplacements(cores, rules);

  const out: T[] = [];
  let i = 0;
  let r = 0;
  while (i < words.length) {
    if (r < reps.length && reps[r].start === i) {
      const rep = reps[r];
      const firstTok = tokens[i];
      const lastTok = tokens[i + rep.length - 1];
      const first = words[i];
      const last = words[i + rep.length - 1];
      out.push({
        ...first,
        text: firstTok.prefix + rep.to + lastTok.suffix,
        start: first.start,
        end: last.end,
      });
      i += rep.length;
      r++;
    } else {
      out.push(words[i]);
      i++;
    }
  }
  return out;
}
