// chrF — character n-gram F-score (Popović, 2015). A reference-based machine-
// translation metric that, unlike BLEU, works well on short segments and needs
// no tokenizer, which suits an offline, dependency-free harness. We use it to
// compare translation configs (e.g. Whisper-translate vs Opus-MT) on a fixture
// set with English references.
//
// Returns a score in [0, 1] (multiply by 100 for the conventional scale).
// Character n-grams up to order `maxN`, F-beta with beta=2 (recall-weighted, as
// in the original chrF). Case- and whitespace-normalized for robustness.

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function ngramCounts(s: string, n: number): Map<string, number> {
  const counts = new Map<string, number>();
  for (let i = 0; i + n <= s.length; i++) {
    const g = s.slice(i, i + n);
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return counts;
}

function overlap(a: Map<string, number>, b: Map<string, number>): number {
  let matches = 0;
  for (const [g, ca] of a) {
    const cb = b.get(g);
    if (cb) matches += Math.min(ca, cb);
  }
  return matches;
}

export function chrf(hypothesis: string, reference: string, maxN = 6, beta = 2): number {
  const hyp = normalize(hypothesis);
  const ref = normalize(reference);

  if (hyp.length === 0 && ref.length === 0) return 1;
  if (hyp.length === 0 || ref.length === 0) return 0;

  const precisions: number[] = [];
  const recalls: number[] = [];

  for (let n = 1; n <= maxN; n++) {
    const hypGrams = ngramCounts(hyp, n);
    const refGrams = ngramCounts(ref, n);
    let hypTotal = 0;
    for (const c of hypGrams.values()) hypTotal += c;
    let refTotal = 0;
    for (const c of refGrams.values()) refTotal += c;
    if (hypTotal === 0 || refTotal === 0) continue;
    const matches = overlap(hypGrams, refGrams);
    precisions.push(matches / hypTotal);
    recalls.push(matches / refTotal);
  }

  if (precisions.length === 0) return 0;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const p = avg(precisions);
  const r = avg(recalls);
  if (p === 0 && r === 0) return 0;

  const b2 = beta * beta;
  return ((1 + b2) * p * r) / (b2 * p + r);
}
