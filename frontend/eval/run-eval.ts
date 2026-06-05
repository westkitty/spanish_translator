// Offline accuracy harness. Scores transcription hypotheses against Spanish
// ground-truth references using the same pure WER/CER module the app ships.
//
// This runner deliberately does NOT load the model itself: running Whisper in
// Node would diverge from the real WASM/WebView path. Instead the workflow is:
//
//   1. Transcribe each eval clip IN THE APP (the real pipeline), export the
//      Spanish transcript, and paste it into the case's `hypothesis` field
//      (or drop it at eval/hypotheses/<id>.txt).
//   2. Run `npm run eval` to get per-clip and aggregate WER/CER.
//   3. Change one thing (dtype, model, decoding flag…), repeat, compare.
//
// A "case" is a JSON file in eval/cases/ shaped like:
//   { "id": "news-01", "audio": "news-01.mp3", "reference": "el gato...",
//     "hypothesis": "el pato..." }
// `hypothesis` may be omitted/empty; such cases are reported as PENDING and
// skipped from the aggregate. `audio` is documentation only (which file to run).
//
// Run:  node eval/run-eval.ts [--gate <maxWer>] [--fold-diacritics]
// Node 23+ strips TS types natively, so no build step is needed.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreTranscript } from '../src/lib/wer.ts';
import { chrf } from '../src/lib/chrf.ts';

const here = dirname(fileURLToPath(import.meta.url));
const casesDir = join(here, 'cases');
const hypDir = join(here, 'hypotheses');

interface EvalCase {
  id: string;
  audio?: string;
  reference: string;
  hypothesis?: string;
  /** Optional English ground-truth + the app's translation, for chrF scoring. */
  referenceTranslation?: string;
  hypothesisTranslation?: string;
}

const args = process.argv.slice(2);
const gateIdx = args.indexOf('--gate');
const gate = gateIdx >= 0 ? Number(args[gateIdx + 1]) : null;
const foldDiacritics = args.includes('--fold-diacritics');

function loadCases(): EvalCase[] {
  if (!existsSync(casesDir)) return [];
  return readdirSync(casesDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const c = JSON.parse(readFileSync(join(casesDir, f), 'utf8')) as EvalCase;
      // Allow an external hypotheses/<id>.txt to override the inline field.
      const ext = join(hypDir, `${c.id}.txt`);
      if (existsSync(ext)) c.hypothesis = readFileSync(ext, 'utf8').trim();
      const extEn = join(hypDir, `${c.id}.en.txt`);
      if (existsSync(extEn)) c.hypothesisTranslation = readFileSync(extEn, 'utf8').trim();
      return c;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

const cases = loadCases();
if (cases.length === 0) {
  console.log(
    '\nNo eval cases found in eval/cases/.\n' +
      'Add <id>.json files with { id, audio, reference } and a hypothesis\n' +
      '(inline or at eval/hypotheses/<id>.txt) to measure accuracy.\n'
  );
  process.exit(0);
}

const opts = { foldDiacritics };
let totalEdits = 0;
let totalRefWords = 0;
let totalCharEdits = 0;
let totalRefChars = 0;
let scored = 0;
let pending = 0;

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const pad = (s: string, n: number) => s.padEnd(n);

console.log('\nOffline transcription accuracy report');
console.log('='.repeat(64));
console.log(`${pad('clip', 16)}${pad('WER', 10)}${pad('CER', 10)}${pad('S/D/I', 14)}words`);
console.log('-'.repeat(64));

for (const c of cases) {
  if (!c.hypothesis || c.hypothesis.trim() === '') {
    console.log(`${pad(c.id, 16)}${pad('PENDING', 10)}${pad('—', 10)}${pad('—', 14)}${'—'}`);
    pending++;
    continue;
  }
  const s = scoreTranscript(c.reference, c.hypothesis, opts);
  // `example-*` cases are documentation of the scoring output; they don't count
  // toward the aggregate or the regression gate.
  const isExample = c.id.startsWith('example');
  if (!isExample) {
    totalEdits += s.substitutions + s.deletions + s.insertions;
    totalRefWords += s.refWords;
    totalCharEdits += Math.round(s.cer * s.refChars);
    totalRefChars += s.refChars;
    scored++;
  }
  console.log(
    `${pad(c.id + (isExample ? '*' : ''), 16)}${pad(pct(s.wer), 10)}${pad(pct(s.cer), 10)}` +
      `${pad(`${s.substitutions}/${s.deletions}/${s.insertions}`, 14)}${s.refWords}`
  );
}

console.log('-'.repeat(64));
const aggWer = totalRefWords ? totalEdits / totalRefWords : 0;
const aggCer = totalRefChars ? totalCharEdits / totalRefChars : 0;
console.log(`${pad('AGGREGATE', 16)}${pad(pct(aggWer), 10)}${pad(pct(aggCer), 10)}`);
console.log('='.repeat(64));
console.log(
  `Scored ${scored} clip(s), ${pending} pending. ` +
    `${totalRefWords} reference words.  (* = demo, excluded from aggregate/gate)\n`
);

// Optional translation quality (chrF) for cases that supply English references.
const translationCases = cases.filter(
  (c) => c.referenceTranslation && c.hypothesisTranslation
);
if (translationCases.length > 0) {
  console.log('Translation quality (chrF, higher is better)');
  console.log('-'.repeat(40));
  let chrfSum = 0;
  for (const c of translationCases) {
    const score = chrf(c.hypothesisTranslation!, c.referenceTranslation!);
    chrfSum += score;
    console.log(`${pad(c.id, 24)}${(score * 100).toFixed(1)}`);
  }
  console.log('-'.repeat(40));
  console.log(`${pad('MEAN chrF', 24)}${((chrfSum / translationCases.length) * 100).toFixed(1)}\n`);
}

if (gate !== null && aggWer > gate) {
  console.error(`FAIL: aggregate WER ${pct(aggWer)} exceeds gate ${pct(gate)}.`);
  process.exit(1);
}
