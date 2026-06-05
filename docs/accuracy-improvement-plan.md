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

### Phase 2 — Decoding, prompting, chunking, merge
- [ ] VAD silence trimming (Silero / `@ricky0123/vad-web`)
- [ ] VAD-aware window boundaries (cut at silence, not fixed 28 s)
- [ ] Temperature fallback + compression/logprob/no-speech thresholds (verify
      Transformers.js support empirically)
- [ ] Capture per-word logprob → confidence on `CaptionWord`
- [ ] Confidence/text-similarity overlap reconciliation in `merge.ts`
- [ ] Cross-seam repeat/hallucination repair
- [ ] Glossary post-processor (the *real* vocabulary feature) + UI
- [ ] "Needs review" low-confidence highlighting in the editor

### Phase 3 — Model tier upgrade
- [ ] Expand `WhisperModel` to tiny | base | small | large-v3-turbo
- [ ] Tier UI (Fast / Balanced / Accurate / Best); `small` default where capable
- [ ] WebGPU feature-detect path (fp16 / q4f16) with WASM fallback
- [ ] Multi-tier model caching; README footprint update
- [ ] Benchmark largest practical model on real devices

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
