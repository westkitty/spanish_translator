# Spanish Whisper Engine — Output, Reliability & UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the working on-device transcriber into a genuinely useful, trustworthy, non-intimidating tool — OOM-safe chunked processing with an accurate device-based ETA, persistent saved outputs, richer export formats, output-quality controls, better editing/playback, re-runs, mic input, and segmentation.

**Architecture:** Keep the fully on-device, no-server model. Rework the inference worker to process audio in bounded windows (chunks) so long files never OOM, emit per-chunk progress that the main thread converts into a device-calibrated ETA, and merge chunk results with overlap dedup. Layer an IndexedDB persistence store underneath the UI for a project library + autosave. Keep all heavy logic in **pure, unit-tested modules** (`src/lib/*`) so correctness is verifiable without a device; reserve the worker/UI for orchestration.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind v4 + Capacitor (Android). `@huggingface/transformers` (Whisper ONNX/WASM). New: Vitest + fake-indexeddb (tests), `@capacitor/filesystem` + `@capacitor/share` (native save/share). Spanish source only.

---

## Cross-cutting principles

- **Spanish-only source.** No source-language selector. Output stays: Spanish transcript (word-level) + English translation (segment-level).
- **Welcoming UX.** Friendly, encouraging copy everywhere ("Hang tight — about 2 minutes left", "All done! 🎉" — emoji only in prose, never as UI icons). Soft glass + azure aesthetic already established. No raw jargon in user-facing text.
- **Pure logic is tested.** Every `src/lib/*` module added here ships with a Vitest spec. UI/worker wiring is verified by build + live preview.
- **Frequent commits.** One commit per task. Build (`npm run build`) must pass before each commit.

## File structure (new + modified)

```
frontend/
├── vitest.config.ts                      # NEW — test runner
├── src/
│   ├── lib/
│   │   ├── chunker.ts                     # NEW — split PCM into overlapped windows (pure)
│   │   ├── merge.ts                       # NEW — merge chunk word/segment results, dedup overlap (pure)
│   │   ├── eta.ts                         # NEW — device-calibrated ETA estimator (pure)
│   │   ├── exporters.ts                   # NEW — transcript -> TXT/SRT/VTT/CSV/bilingual (pure)
│   │   ├── srt.ts                         # NEW — timestamp formatting helpers (pure)
│   │   ├── punctuation.ts                 # NEW — sentence/paragraph reconstruction (pure)
│   │   ├── vad.ts                         # NEW — silence/voice-activity segmentation (pure)
│   │   ├── db.ts                          # NEW — IndexedDB project store
│   │   ├── fileSave.ts                    # NEW — Capacitor Filesystem + Share wrapper
│   │   ├── audio.ts                        # MODIFY — expose raw PCM + clip extraction
│   │   └── transcriber.worker.ts          # MODIFY — chunked loop, per-chunk progress, cancel
│   ├── hooks/
│   │   ├── useTranscriber.ts              # MODIFY — progress/ETA/cancel, params, re-run
│   │   ├── useProjects.ts                 # NEW — library CRUD over db.ts
│   │   ├── useRecorder.ts                 # NEW — in-app mic capture
│   │   └── useAudioPlayer.ts              # MODIFY — playbackRate, A/B loop
│   ├── components/
│   │   ├── ProgressPanel.tsx              # NEW — bar + %, elapsed, ETA, cancel, friendly copy
│   │   ├── LibraryModal.tsx               # NEW — saved projects list
│   │   ├── AdvancedOptions.tsx            # NEW — vocab prompt, quality, model
│   │   ├── TranscriptView.tsx             # NEW — paragraph view + find & replace
│   │   ├── CaptionEditor.tsx              # MODIFY — confidence tint, undo/redo
│   │   ├── CaptionExport.tsx              # MODIFY — SRT/VTT/CSV/bilingual + native save/share
│   │   └── ... (existing)
│   └── App.tsx                            # MODIFY — wire new screens/state
```

---

## PHASE 0 — Test tooling

### Task 0.1: Add Vitest

**Files:** Modify `frontend/package.json`; Create `frontend/vitest.config.ts`

- [ ] Install: `npm i -D vitest fake-indexeddb`
- [ ] Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
```

- [ ] Add scripts: `"test": "vitest run"`, `"test:watch": "vitest"`
- [ ] Commit: `chore(test): add vitest + fake-indexeddb`

---

## PHASE 1 — OOM-safe chunked engine + device-accurate ETA  *(foundation; user-critical)*

**Design.** Decode once to 16 kHz mono Float32 (existing `audio.ts`). Split into windows of `windowSec` (default 28s) with `overlapSec` (default 4s). The worker runs Whisper on **one window at a time** for both passes (transcribe + translate), freeing references between windows so peak memory is ~one window, not the whole file. After each window the worker posts `{ pass, windowIndex, windowCount, windowWallMs }`. The main thread feeds wall-times into the ETA estimator (rolling mean of per-window time × windows remaining across both passes) → an ETA that is calibrated to *this device's* measured speed. Results are merged by offsetting each window's timestamps by its start and discarding duplicate words/segments inside the overlap.

### Task 1.1: `chunker.ts` (pure)

**Files:** Create `src/lib/chunker.ts`, `src/lib/chunker.test.ts`

- [ ] Test first:

```ts
import { describe, it, expect } from 'vitest';
import { planWindows } from './chunker';

describe('planWindows', () => {
  it('covers the whole signal with overlap', () => {
    const w = planWindows(16000 * 60, 16000, 28, 4); // 60s @16k
    expect(w[0]).toMatchObject({ startSample: 0 });
    expect(w[0].startSec).toBe(0);
    // windows advance by (window - overlap) = 24s
    expect(w[1].startSec).toBeCloseTo(24, 5);
    expect(w[w.length - 1].endSample).toBe(16000 * 60);
  });
  it('returns a single window for short clips', () => {
    const w = planWindows(16000 * 10, 16000, 28, 4);
    expect(w).toHaveLength(1);
  });
});
```

- [ ] Implement:

```ts
export interface Window {
  index: number;
  startSample: number;
  endSample: number;
  startSec: number;
  endSec: number;
}

export function planWindows(
  totalSamples: number,
  sampleRate: number,
  windowSec: number,
  overlapSec: number
): Window[] {
  const windowSamples = Math.round(windowSec * sampleRate);
  const hop = Math.round((windowSec - overlapSec) * sampleRate);
  if (totalSamples <= windowSamples) {
    return [{ index: 0, startSample: 0, endSample: totalSamples, startSec: 0, endSec: totalSamples / sampleRate }];
  }
  const windows: Window[] = [];
  let start = 0;
  let i = 0;
  while (start < totalSamples) {
    const end = Math.min(start + windowSamples, totalSamples);
    windows.push({ index: i, startSample: start, endSample: end, startSec: start / sampleRate, endSec: end / sampleRate });
    if (end >= totalSamples) break;
    start += hop;
    i++;
  }
  return windows;
}

export function sliceSamples(pcm: Float32Array, w: Window): Float32Array {
  return pcm.subarray(w.startSample, w.endSample);
}
```

- [ ] Run `npm test`, commit: `feat(engine): add windowed chunk planner`

### Task 1.2: `merge.ts` (pure)

**Files:** Create `src/lib/merge.ts`, `src/lib/merge.test.ts`

- [ ] Test: two windows with overlapping words at the seam produce one deduped, time-ordered list; timestamps are offset by window start.
- [ ] Implement `mergeWindowed(items: TimedItem[][], windows: Window[], overlapSec)`:
  - Offset each item's `start`/`end` by `windows[k].startSec`.
  - In the overlap zone between window k and k+1 (from `windows[k+1].startSec` to `windows[k].endSec`), keep items from window k up to the overlap midpoint and items from window k+1 after it; drop the rest. (Dedup by midpoint cut — simple, deterministic, testable.)
  - Re-id sequentially.
  - `TimedItem = { text: string; start: number; end: number }`.
- [ ] Run tests, commit: `feat(engine): merge windowed results with overlap dedup`

### Task 1.3: `eta.ts` (pure)

**Files:** Create `src/lib/eta.ts`, `src/lib/eta.test.ts`

- [ ] Test:

```ts
import { EtaEstimator } from './eta';
it('extrapolates from measured units', () => {
  const e = new EtaEstimator(10);        // 10 total units of work
  e.record(1000); e.record(1000);        // 2 units @1s each
  expect(e.remainingMs()).toBe(8000);    // 8 units * 1000ms
  expect(e.fraction()).toBeCloseTo(0.2, 5);
});
```

- [ ] Implement `EtaEstimator`: `record(ms)`, rolling mean (weight recent units a bit higher), `remainingMs()`, `fraction()`, `elapsedMs()`. Total work units = `windowCount * passesPerWindow` (2). Returns `null` until ≥1 unit recorded.
- [ ] Run tests, commit: `feat(engine): add device-calibrated ETA estimator`

### Task 1.4: Worker — chunked loop + cancel

**Files:** Modify `src/lib/transcriber.worker.ts`

- [ ] Replace single-shot pipeline calls with: `planWindows` → for each window, run transcribe then translate on the slice (`return_timestamps:'word'` / `true`), post `{type:'window', pass, windowIndex, windowCount, wallMs}` after each, accumulate raw results.
- [ ] After all windows: `mergeWindowed` both result sets → post `{type:'result', words, translation}`.
- [ ] Support `{type:'cancel'}`: set a flag checked between windows; abort cleanly with `{type:'cancelled'}`.
- [ ] Null out per-window references after each iteration to bound memory.
- [ ] Build, commit: `feat(engine): chunked transcription loop with cancel`

### Task 1.5: Hook — progress/ETA/cancel

**Files:** Modify `src/hooks/useTranscriber.ts`

- [ ] Track `progress: { fraction, etaMs, elapsedMs, phaseLabel } | null` driven by worker `window` messages + `EtaEstimator`.
- [ ] Add `cancel()` (posts `{type:'cancel'}`, resets to idle).
- [ ] Expose for re-run (Phase 6): keep last `RunOptions`.
- [ ] Build, commit: `feat(engine): surface progress, ETA, and cancel from hook`

### Task 1.6: `ProgressPanel.tsx` — welcoming progress UI

**Files:** Create `src/components/ProgressPanel.tsx`; Modify `App.tsx`

- [ ] Glass card with: determinate bar (`fraction`), big friendly headline that changes by phase ("Listening to your audio…", "Writing it down…", "Translating to English…"), `~X min Y sec left` from `etaMs` (hide until first estimate; show "Estimating…" before), elapsed time, and a **Cancel** button. Encouraging microcopy. `aria-live="polite"` on the status text. Respect reduced-motion.
- [ ] Replace the old inline status block in `App.tsx` with `<ProgressPanel />`.
- [ ] Build + live preview screenshot, commit: `feat(ui): friendly progress panel with device ETA and cancel`

---

## PHASE 2 — Persistence: project library + autosave

### Task 2.1: `db.ts` — IndexedDB store

**Files:** Create `src/lib/db.ts`, `src/lib/db.test.ts` (use `fake-indexeddb/auto`)

- [ ] `Project = { id, name, createdAt, updatedAt, model, params, durationSec, audioBlob: Blob, words: CaptionWord[], translation: Translation }`.
- [ ] CRUD: `putProject`, `getProject`, `listProjects` (metadata only, no blobs), `deleteProject`. Object store `projects`, index on `updatedAt`.
- [ ] Tests with fake-indexeddb. Commit: `feat(db): indexeddb project store`

### Task 2.2: `useProjects.ts` + Library UI

**Files:** Create `src/hooks/useProjects.ts`, `src/components/LibraryModal.tsx`; Modify `App.tsx`

- [ ] Hook: `projects`, `save(current)`, `open(id)`, `remove(id)`, `rename(id,name)`.
- [ ] On a completed run, auto-create a project (name = file name + date). Add a header "Library" button opening `LibraryModal` (glass, list with name/date/duration, open/rename/delete, friendly empty state).
- [ ] Opening a project rehydrates audio (objectURL from blob) + words + translation.
- [ ] Build + preview, commit: `feat(library): persistent saved projects`

### Task 2.3: Autosave edits

**Files:** Modify `App.tsx` (or a `useAutosave` effect)

- [ ] Debounced (800ms) `putProject` whenever `captions` change for the active project. Subtle "Saved" indicator.
- [ ] Build, commit: `feat(library): autosave transcript edits`

---

## PHASE 3 — Richer exports + native save/share

### Task 3.1: `srt.ts` + `exporters.ts` (pure)

**Files:** Create `src/lib/srt.ts`, `src/lib/exporters.ts`, plus `.test.ts` for each

- [ ] `srt.ts`: `formatTimestamp(sec, sep)` → `HH:MM:SS,mmm` (SRT) / `HH:MM:SS.mmm` (VTT). Test edge cases (0, 3661.5).
- [ ] `exporters.ts`: pure builders over `{ words, translation }`:
  - `toTxt`, `toSrt` (cue per segment; segments from translation timing or word grouping), `toVtt`, `toCsv` (`text,start,end`), `toBilingualSrt` (Spanish cue + English line), `toBilingualTxt`.
  - Tests assert exact strings for a small fixture.
- [ ] Commit: `feat(export): SRT/VTT/CSV/bilingual exporters (tested)`

### Task 3.2: `fileSave.ts` + wire into `CaptionExport`

**Files:** Create `src/lib/fileSave.ts`; Modify `CaptionExport.tsx`; install `@capacitor/filesystem @capacitor/share`

- [ ] `saveTextFile(name, mime, content)`: on native (Capacitor) → `Filesystem.writeFile` to Documents + `Share.share`; on web → existing `<a download>` fallback. Detect via `Capacitor.isNativePlatform()`.
- [ ] Expand `CaptionExport` UI: format grid (TXT, SRT, VTT, CSV, Bilingual, JSON) + a "Share" action. Friendly labels, no jargon ("Subtitles (.srt)").
- [ ] `npx cap sync android`; build; commit: `feat(export): native save + share, new subtitle/csv formats`

---

## PHASE 4 — Output quality

### Task 4.1: Advanced options (vocab prompt + quality)

**Files:** Create `src/components/AdvancedOptions.tsx`; Modify `useTranscriber.ts`, `transcriber.worker.ts`, `App.tsx`

- [ ] Collapsible "Advanced" glass section: **Vocabulary hint** textarea (names/terms) → passed as Whisper `initial_prompt` / `prompt`; **Accuracy** toggle mapping to `num_beams` (1 vs 5) and `temperature`. Default off/simple so it isn't intimidating.
- [ ] Thread `params` through hook → worker → pipeline call (per window: pass `prompt`).
- [ ] Build, commit: `feat(quality): vocabulary hint + accuracy controls`

### Task 4.2: Confidence highlighting

**Files:** Modify `transcriber.worker.ts` (capture per-word avg logprob), `CaptionEditor.tsx`

- [ ] Request token logprobs; attach `confidence` (0–1, normalized from logprob) to each `CaptionWord`. Extend `CaptionWord` with optional `confidence`.
- [ ] In editor, tint words below a threshold (amber) with a tooltip "Low confidence — tap to check". Legend + toggle. Encouraging framing, not alarming.
- [ ] Build + preview, commit: `feat(quality): low-confidence word highlighting`

### Task 4.3: Punctuation/sentence reconstruction

**Files:** Create `src/lib/punctuation.ts` (+test); Modify `TranscriptView` (Phase 5) consumer

- [ ] `buildSentences(words, segments)`: align word timestamps to translation/transcript segment boundaries to recover capitalization + punctuation + paragraph breaks → `Sentence[] = { text, start, end, words }`.
- [ ] Tests on a fixture. Commit: `feat(quality): sentence/paragraph reconstruction`

---

## PHASE 5 — Editing & reading

### Task 5.1: Paragraph view + find & replace

**Files:** Create `src/components/TranscriptView.tsx`; Modify `App.tsx`

- [ ] Toggle between "Words" (existing chip editor) and "Read" (paragraphs from `buildSentences`, click sentence to seek). Find & replace bar (match count, replace-all) operating on `captions` (updates word text in place).
- [ ] Build + preview, commit: `feat(edit): paragraph view + find and replace`

### Task 5.2: Undo/redo + revert to original

**Files:** Modify `App.tsx` (edit history stack)

- [ ] Keep original transcript snapshot + an undo/redo stack for caption edits. Buttons in editor header. Keyboard: Cmd/Ctrl+Z / Shift+Z.
- [ ] Build, commit: `feat(edit): undo/redo and revert to original`

---

## PHASE 6 — Re-run

### Task 6.1: Re-run whole file (different model/params)

**Files:** Modify `App.tsx`, `useTranscriber.ts`

- [ ] "Re-run" control on the results screen: reopen options (model/quality/vocab), confirm (warns edits will be replaced), re-run on the retained decoded PCM (no re-decode).
- [ ] Build, commit: `feat(rerun): re-transcribe whole file with new settings`

### Task 6.2: Re-transcribe a selected region

**Files:** Modify `AudioCanvas.tsx` (range select), `useTranscriber.ts`, `transcriber.worker.ts`

- [ ] Drag-select a time range on the canvas → re-run only that PCM slice → splice merged words back into `captions` for that span (reuse `mergeWindowed` math for the seam). Keeps the rest of the transcript and edits intact.
- [ ] Build + preview, commit: `feat(rerun): re-transcribe a selected region`

---

## PHASE 7 — Playback aids

### Task 7.1: Speed + A/B loop + shortcuts

**Files:** Modify `useAudioPlayer.ts`, player UI in `App.tsx`

- [ ] `playbackRate` (0.5/0.75/1/1.25/1.5/2); A/B loop (set in/out, loop region); keyboard shortcuts (Space play/pause, ←/→ seek 5s, Tab next word). Show shortcut hints.
- [ ] Build, commit: `feat(player): speed, A/B loop, keyboard shortcuts`

---

## PHASE 8 — Mic input

### Task 8.1: In-app recording

**Files:** Create `src/hooks/useRecorder.ts`; Modify `App.tsx`; Android mic permission

- [ ] `useRecorder`: MediaRecorder → Blob → same decode+transcribe path. "Record" tab beside "Choose file". Big friendly record button, level meter, timer.
- [ ] Add `RECORD_AUDIO` permission to AndroidManifest; `npx cap sync`.
- [ ] Build + preview, commit: `feat(input): in-app microphone recording`

---

## PHASE 9 — Segmentation & clip export

### Task 9.1: `vad.ts` silence segmentation (pure)

**Files:** Create `src/lib/vad.ts` (+test)

- [ ] `findSilences(pcm, sampleRate, { thresholdDb, minSilenceSec })` → `[{start,end}]` via RMS energy windows. `segmentByGaps(words, silences)` → paragraph groups. Tests on synthetic signal.
- [ ] Commit: `feat(segment): silence/voice-activity segmentation`

### Task 9.2: Paragraph breaks + per-segment audio clip export

**Files:** Modify `audio.ts` (clip extraction → WAV Blob), `TranscriptView.tsx`, `CaptionExport.tsx`

- [ ] Use `segmentByGaps` to insert paragraph breaks in Read view. Add "Export clip" on a segment → encode that PCM slice to a WAV Blob + its text (and `fileSave`/Share). Pure WAV encoder in `audio.ts` (tested).
- [ ] Build + preview, commit: `feat(segment): paragraph breaks + per-segment audio clip export`

---

## PHASE 10 — Welcoming-UX polish pass (cross-cutting finish)

### Task 10.1: Tone + empty/edge states

**Files:** Touch user-facing strings across components; `WelcomeScreen`, `FaqModal`, `ProgressPanel`, errors

- [ ] Audit every user-facing string for warmth and plain language. Friendly empty states (library, no-file, no-results), gentle error recovery ("That file wouldn't open — try MP3/WAV/M4A/OGG"), success celebration on completion. Add a one-time inline tip on first results ("Tap any word to fix it").
- [ ] First-run-only welcome (persist `seenWelcome` in localStorage) with a "Show again" in FAQ.
- [ ] Build + preview at 375/768/1024, commit: `feat(ux): warm tone, empty/edge states, first-run welcome`

---

## Coverage check (spec → phase)

| Requested item | Phase |
|---|---|
| Different save formats (SRT/VTT/CSV/bilingual) | 3 |
| Rerun (whole + region) | 6 |
| Improve outputs (vocab/quality, confidence, punctuation) | 4 |
| Persist & save outputs (library + autosave) | 2 |
| Reliable accurate progress bar + device ETA | 1 |
| Chunking to prevent OOM | 1 |
| Welcoming / non-intimidating UX | 1 + 10 (cross-cutting) |
| Native save/share | 3 |
| Paragraph view + find/replace | 5 |
| Playback aids | 7 |
| Mic recording | 8 |
| Silence segmentation | 9 |
| Audio-clip export | 9 |
| Undo/redo | 5 |

## Verification per phase
- Pure modules: `npm test` green.
- App: `npm run build` clean; live preview screenshot of new UI; `npx cap sync android` + release APK build for phases touching native (3, 8).
- One commit per task; one release at meaningful milestones (end of P1, P3, P6, P10).
