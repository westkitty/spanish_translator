# Offline accuracy harness

Measures Spanish transcription accuracy (WER + CER) so every accuracy change can
be **proven, not guessed**. Scoring uses the same pure module the app ships
(`src/lib/wer.ts`).

## Why it doesn't run the model

Running Whisper in Node would diverge from the real WASM/Capacitor-WebView path
(different ONNX backend, threads, quantization behavior). So the harness scores
hypotheses you produce **with the actual app**, on the actual target.

## Workflow

1. Put a Spanish clip somewhere and write its **ground-truth** transcript.
2. Add `eval/cases/<id>.json`:
   ```json
   {
     "id": "news-01",
     "audio": "news-01.mp3",
     "reference": "exact human transcript of the audio"
   }
   ```
3. Run that same clip through the app (real pipeline), export the Spanish
   transcript, and either:
   - paste it into the case's `"hypothesis"` field, **or**
   - save it to `eval/hypotheses/news-01.txt` (overrides the inline field).
4. Score:
   ```bash
   npm run eval                 # report
   npm run eval -- --gate 0.25  # also fail if aggregate WER > 25%
   npm run eval -- --fold-diacritics   # ignore accents in scoring
   ```

## Reading the output

- **WER** — Word Error Rate `(subs + dels + ins) / reference words`. Headline.
- **CER** — Character Error Rate. Catches diacritic/spelling errors WER's token
  matching can hide (`año` vs `ano`).
- **S/D/I** — substitutions / deletions / insertions. Diagnoses *what kind* of
  errors a change trades.
- **AGGREGATE** — micro-averaged across all scored clips (weighted by length).

## A/B comparing a change

Run the suite, change one thing (encoder dtype, model tier, a decoding flag),
re-export hypotheses, run again. Keep a note of aggregate WER/CER per config.

## Regression gate

`npm run eval:gate` runs with `--gate 0.25` and exits non-zero if aggregate WER
exceeds 25%. Use it as a release check. `example-*` cases (marked `*`) are demos
and are excluded from the aggregate and the gate.

## Building a good fixture set

Aim for 8–12 clips spanning: clean studio speech, phone/field noise, fast vs
slow speakers, regional accents (Iberian, Mexican, Rioplatense…), proper nouns,
numbers, and at least one long clip (>2 min) to exercise window stitching.
Keep them short enough to iterate quickly.
