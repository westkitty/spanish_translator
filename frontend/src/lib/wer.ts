// Pure, dependency-free Word Error Rate (WER) and Character Error Rate (CER)
// scoring for the offline evaluation harness. Nothing here touches the model,
// the DOM, or the network — it is the measurement substrate that lets every
// other accuracy change be proven rather than guessed at.
//
//   WER = (Substitutions + Deletions + Insertions) / ReferenceWordCount
//   CER = same, computed over characters
//
// Both use Levenshtein edit distance with full backtrace so we can report the
// individual S/D/I counts (useful for diagnosing whether a change trades, say,
// deletions for substitutions).

export interface NormalizeOptions {
  /** Fold accented characters to ASCII (á→a, ñ→n). Off by default so diacritic
   *  errors are still counted — Spanish accuracy cares about them. */
  foldDiacritics?: boolean;
}

/** Lowercase, strip punctuation, optionally fold diacritics, collapse whitespace. */
export function normalizeForScoring(text: string, opts: NormalizeOptions = {}): string {
  let out = text.toLowerCase();
  if (opts.foldDiacritics) {
    out = out.normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  // Remove anything that isn't a letter (incl. accented), digit, or whitespace.
  // \p{L} covers Unicode letters; \p{N} covers numbers.
  out = out.replace(/[^\p{L}\p{N}\s]/gu, ' ');
  return out.replace(/\s+/g, ' ').trim();
}

/** Normalize then split into word tokens. */
export function tokenize(text: string, opts?: NormalizeOptions): string[] {
  const normalized = normalizeForScoring(text, opts);
  return normalized.length ? normalized.split(' ') : [];
}

export interface EditCounts {
  substitutions: number;
  deletions: number;
  insertions: number;
  distance: number;
}

/** Levenshtein edit distance between two token sequences, with S/D/I backtrace. */
export function editCounts<T>(ref: T[], hyp: T[]): EditCounts {
  const n = ref.length;
  const m = hyp.length;

  // dp[i][j] = edit distance between ref[0..i) and hyp[0..j).
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (ref[i - 1] === hyp[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j - 1], // substitution
          dp[i - 1][j],     // deletion (ref token not in hyp)
          dp[i][j - 1]      // insertion (extra hyp token)
        );
      }
    }
  }

  // Backtrace to count S / D / I separately.
  let i = n;
  let j = m;
  let substitutions = 0;
  let deletions = 0;
  let insertions = 0;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && ref[i - 1] === hyp[j - 1] && dp[i][j] === dp[i - 1][j - 1]) {
      i--; j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      substitutions++; i--; j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      deletions++; i--;
    } else {
      insertions++; j--;
    }
  }

  return { substitutions, deletions, insertions, distance: dp[n][m] };
}

/** Convenience: raw edit distance only. */
export function editDistance<T>(ref: T[], hyp: T[]): number {
  return editCounts(ref, hyp).distance;
}

export interface WerResult extends EditCounts {
  wer: number;
  refLength: number;
}

/** Word Error Rate between a reference transcript and a hypothesis. */
export function wer(reference: string, hypothesis: string, opts?: NormalizeOptions): WerResult {
  const refTokens = tokenize(reference, opts);
  const hypTokens = tokenize(hypothesis, opts);
  const counts = editCounts(refTokens, hypTokens);
  const refLength = refTokens.length;
  return {
    ...counts,
    refLength,
    wer: refLength === 0 ? (hypTokens.length === 0 ? 0 : 1) : counts.distance / refLength,
  };
}

export interface CerResult extends EditCounts {
  cer: number;
  refLength: number;
}

/** Character Error Rate. Normalizes (case/punct/whitespace) before comparing. */
export function cer(reference: string, hypothesis: string, opts?: NormalizeOptions): CerResult {
  const refChars = [...normalizeForScoring(reference, opts).replace(/\s+/g, '')];
  const hypChars = [...normalizeForScoring(hypothesis, opts).replace(/\s+/g, '')];
  const counts = editCounts(refChars, hypChars);
  const refLength = refChars.length;
  return {
    ...counts,
    refLength,
    cer: refLength === 0 ? (hypChars.length === 0 ? 0 : 1) : counts.distance / refLength,
  };
}

export interface TranscriptScore {
  wer: number;
  cer: number;
  refWords: number;
  refChars: number;
  substitutions: number;
  deletions: number;
  insertions: number;
}

/** Score a hypothesis against a reference on both WER and CER in one call. */
export function scoreTranscript(
  reference: string,
  hypothesis: string,
  opts?: NormalizeOptions
): TranscriptScore {
  const w = wer(reference, hypothesis, opts);
  const c = cer(reference, hypothesis, opts);
  return {
    wer: w.wer,
    cer: c.cer,
    refWords: w.refLength,
    refChars: c.refLength,
    substitutions: w.substitutions,
    deletions: w.deletions,
    insertions: w.insertions,
  };
}
