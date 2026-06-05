# Spanish Whisper Engine — Accuracy Improvement Roadmap

Staged plan to raise Spanish transcription + English translation accuracy while
preserving the core principle: **all audio and models stay on-device; no server,
API, or upload path is introduced.**

Branch: `feat/accuracy-improvements`. Each phase is one (or more) commits.

## Diagnosis (why accuracy was poor)
1. **Encoder was q8-quantized.** Whisper's encoder is the most quantization-
   sensitive component; q8 there was the biggest hidden WER loss.
2. **Model was `whisper-base`.** Demo-grade for Spanish; `small` is the usable floor.
3. **Vocabulary hint was a no-op.** Transformers.js ignores Whisper `prompt`
   (issues #1028/#923), so the feature silently did nothing → must be a
   post-processing glossary instead.
4. **No hallucination guards.** Custom 28 s windows are short-form, so Whisper's
   temperature-fallback / compression-ratio / no-speech heuristics never fired.
5. **No measurement.** No WER/CER harness → every change was a guess.

## Phases

### Phase 1 — Measurement & fast wins  ✅ (this branch)
- [x] `src/lib/wer.ts` (+tests) — pure WER/CER scoring
- [x] `eval/` harness + `npm run eval` (scores app-exported hypotheses vs refs)
- [x] Encoder dtype fp32 + decoder q8 (per-module dtype) in worker
- [x] `src/lib/audiodsp.ts` (+tests) — DC removal, high-pass, loudness norm,
      clipping detection; applied pre-inference in the worker
- [x] `no_repeat_ngram_size` repeat-loop guard on both passes
- [ ] (deferred) remove double-chunking — needs on-device verification

### Phase 2 — Decoding, prompting, chunking, merge  ✅
- [x] VAD-aware window boundaries — `silenceAwareCuts` snaps handoffs to silence
      (reused the existing energy VAD in `vad.ts`; no Silero dependency added)
- [x] Silence-aware overlap reconciliation in `merge.ts` (cut points override
      the blind midpoint)
- [x] Cross-seam repeat/hallucination repair — `dehallucinate.ts`
      (`collapseRepeatedPhrases`) applied to merged words + translation
- [x] Glossary post-processor — `glossary.ts` (the *real* vocabulary feature,
      replacing the no-op prompt) wired through `useTranscriber` + relabeled UI
- [~] Deferred (need on-device verification / unavailable data):
  - Temperature fallback + compression/logprob/no-speech thresholds — Transformers.js
    coverage is uncertain and could throw; `no_repeat_ngram_size` + `dehallucinate`
    already cover the dominant failure. Revisit once verifiable in-app.
  - Per-word logprob → confidence, and "needs review" highlighting — Transformers.js
    word-timestamp output doesn't reliably expose per-word logprobs; deferred rather
    than fabricate a confidence signal.
  - Leading/trailing silence trimming (timestamp-offset bookkeeping) — low marginal
    value once handoffs are silence-aware.

### Phase 3 — Model tier upgrade  ✅
- [x] `WhisperModel` expanded to tiny | base | small | large-v3-turbo
      (`src/lib/models.ts`, +tests)
- [x] Tier UI (Fast / Balanced / Accurate / Best) built from `MODEL_TIERS`;
      Best is hidden on non-WebGPU devices; Accurate (small) flagged recommended
- [x] WebGPU feature-detect (`detectWebGPU`) + per-device dtype (`resolveBackend`):
      WASM → fp32 encoder/q8 decoder; WebGPU → fp16
- [x] Independent per-tier model caching (Transformers.js Cache API, one entry
      per id); README footprint table updated
- [~] Default left at `base` (safe) and `small` benchmarking on real devices is
      pending — flip `defaultModel()` to `small` once the harness has device
      timings confirming acceptable speed. (On-device WebGPU-in-WebView support
      also needs confirming on the target hardware.)

### Phase 4 — Translation quality
- [ ] Opus-MT `Xenova/opus-mt-es-en` as a dedicated NMT pipeline
- [ ] Remove the per-window Whisper translate pass (also ~2× faster)
- [ ] Translate reconstructed sentences, not raw windows
- [ ] chrF/BLEU translation eval

### Phase 5 — Long-term maintenance
- [ ] Correction → glossary feedback loop
- [ ] Low-confidence clip export for correction
- [ ] Spanish punctuation / diacritic restoration
- [ ] Regression gate (`npm run eval -- --gate <wer>`) wired into release

## Validation note
The TypeScript build + Vitest cover structure and all pure logic. The actual
WASM/WebView inference path (quantization behavior, model loading, decoding
flags honored) must be verified **on device / in the app** — the harness exists
precisely to make that verification quantitative.
