// Repairs Whisper's most common hallucination: runaway verbatim repetition
// ("gracias gracias gracias…" or a looping phrase) that the model emits over
// silence, music, or noise. `no_repeat_ngram_size` in the decoder helps within
// a window, but loops can still survive across window seams after merge, so we
// also repair the assembled result here.
//
// Pure and unit-tested. Conservative by default: it only collapses *immediate*
// repetitions beyond a cap, never reorders or drops non-repeating content.

interface TextItem {
  text: string;
}

export interface CollapseOptions {
  /** How many consecutive copies of a phrase to keep (default 2). */
  maxRepeats?: number;
  /** Longest phrase (in tokens) to test for looping (default 4). */
  maxPhraseLen?: number;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
    .trim();
}

/**
 * Collapse immediate repeated phrases. At each position, the longest phrase
 * length (up to `maxPhraseLen`) that forms a repeating run is collapsed to
 * `maxRepeats` copies; remaining copies are dropped. Kept items retain their
 * original timestamps.
 */
export function collapseRepeatedPhrases<T extends TextItem>(
  items: T[],
  opts: CollapseOptions = {}
): T[] {
  const maxRepeats = opts.maxRepeats ?? 2;
  const maxPhraseLen = opts.maxPhraseLen ?? 4;
  const keys = items.map((it) => norm(it.text));
  const out: T[] = [];

  let i = 0;
  while (i < items.length) {
    let collapsed = false;

    // Use the SHORTEST repeating unit (the fundamental period): a uniform run
    // "a a a a" is a 1-cycle, while "y entonces y entonces" is a 2-cycle whose
    // 1-cycle doesn't repeat. Taking the shortest avoids over-keeping.
    const maxP = Math.min(maxPhraseLen, items.length - i);
    for (let p = 1; p <= maxP; p++) {
      // Count how many times the block keys[i..i+p) repeats consecutively.
      let repeats = 1;
      while (true) {
        const base = i + repeats * p;
        if (base + p > items.length) break;
        let same = true;
        for (let j = 0; j < p; j++) {
          // A run of empty-key tokens (pure punctuation) isn't a hallucination.
          if (keys[i + j] === '' || keys[i + j] !== keys[base + j]) {
            same = false;
            break;
          }
        }
        if (!same) break;
        repeats++;
      }

      if (repeats > maxRepeats) {
        // Keep the first `maxRepeats` blocks, skip the rest of the run.
        const keepBlocks = maxRepeats;
        for (let b = 0; b < keepBlocks; b++) {
          for (let j = 0; j < p; j++) out.push(items[i + b * p + j]);
        }
        i += repeats * p;
        collapsed = true;
        break;
      }
    }

    if (!collapsed) {
      out.push(items[i]);
      i++;
    }
  }

  return out;
}

/**
 * Clean up a machine-translation string. Defense-in-depth against decoder
 * degeneration (runaway "...." / "????" tails and repeated word loops) — even
 * with bounded generation, NMT can occasionally loop, and a phone should never
 * be shown (or have to store) a multi-hundred-character punctuation tail.
 */
export function sanitizeTranslation(text: string): string {
  if (!text) return text;
  // Collapse runs of a repeated punctuation/symbol char: "...." -> ".".
  let out = text.replace(/([^\p{L}\p{N}\s])\1{1,}/gu, '$1');
  // Collapse runaway repeated words/phrases.
  const words = out.split(/\s+/).filter(Boolean).map((w) => ({ text: w }));
  out = collapseRepeatedPhrases(words, { maxRepeats: 2, maxPhraseLen: 6 })
    .map((w) => w.text)
    .join(' ');
  // Tidy spaces before punctuation and collapse whitespace.
  return out.replace(/\s+([,.;:!?])/g, '$1').replace(/\s+/g, ' ').trim();
}
