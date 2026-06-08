# Dexterpreter UI/UX + Large File + Theme Handoff

Date: 2026-06-08
Repository: `westkitty/spanish_translator`

## Current repository read

Dexterpreter is a local-first React/Capacitor app for on-device Spanish audio transcription and English translation. The app is intentionally serverless: audio is decoded locally, passed to a Web Worker, transcribed with Transformers.js/ONNX Runtime, translated with an on-device Opus-MT Spanish-to-English model, edited in the UI, saved locally, and exported.

Current high-value architecture already present:

- `frontend/src/App.tsx` owns the main product flow: file/record input, model options, transcription run, progress panel, saved library, player, waveform, transcript editing, translation, and export.
- `frontend/src/hooks/useTranscriber.ts` owns decode, worker orchestration, status/progress, full-run and region-run logic.
- `frontend/src/lib/transcriber.worker.ts` already processes PCM through short overlapping ASR windows and returns word timestamps plus translated sentence segments.
- `frontend/src/lib/chunker.ts` already plans bounded overlapping ASR windows.
- `frontend/src/lib/audio.ts` currently decodes the whole file on the main thread through Web Audio, then resamples the whole file to 16 kHz mono PCM before transfer to the worker.
- `frontend/src/index.css` already has semantic color tokens, glass surfaces, focus-visible styling, reduced-motion handling, and touch minimum token support.

The important architectural catch: ASR inference is windowed, but initial audio decode/resample is still whole-file. That means the app can process long audio better than a naive one-shot Whisper run, but true hour-long uploads need a chunk preflight + long-file mode so decode, chunk planning, progress, autosave, and recovery are first-class.

---

## 10 UI/UX improvements

1. **Add a visible workflow stepper**
   - Current flow jumps from file/options to progress to results.
   - Add compact status rail: `1 Import -> 2 Prepare -> 3 Transcribe -> 4 Translate -> 5 Review -> 6 Export`.
   - This helps long runs feel predictable instead of frozen.

2. **Add an upload preflight card**
   - After file selection, show duration, size, estimated memory, chosen chunk size, model tier, and offline cache status.
   - For files over a threshold, default to Long File Mode.

3. **Expose chunking as user-facing Long File Mode**
   - Add radio buttons: `Auto`, `5 min chunks`, `10 min chunks`, `Smart silence chunks`.
   - Default: Auto. If duration >= 30 minutes, use 5-minute chunks unless device memory is clearly strong.

4. **Replace single progress with chunk queue progress**
   - Progress should show current chunk, total chunks, current phase, ETA, completed chunks, failed chunks, and retry action.
   - Example: `Chunk 3 of 12 · Transcribing · 24:00-29:00 · About 18 min left`.

5. **Add pause/resume/retry for long jobs**
   - Current cancel behavior is useful, but long audio needs recoverability.
   - Store partial chunk results after each chunk so the user can resume after app interruption.

6. **Make Library more like a project manager**
   - Add search, sort, file duration filter, status badges, and `In progress` entries for long files.
   - Saved transcripts already exist; the UI should expose them as recoverable projects.

7. **Clarify the edit modes**
   - Rename `Edit words` to `Word edit` and `Read` to `Sentence review`.
   - Add helper text: `Word edit is best for timestamp fixes. Sentence review is best for reading, clipping, and exporting.`

8. **Improve destructive action safety**
   - Replace `window.confirm` with the existing Modal component so re-run and delete flows have consistent accessible focus handling, clearer copy, and theme support.

9. **Make waveform controls more discoverable**
   - Region select, loop A/B, speed, and shortcuts are powerful but visually flat.
   - Group them under labeled rows: `Selection`, `Loop`, `Playback`.

10. **Add theme switching as a product feature, not a gimmick**
    - Put a palette button beside Library and FAQ.
    - Open a compact popover/palette tray with 4 theme cards, preview swatches, and a short label.
    - Persist selected theme in localStorage and apply it before first paint.

---

## Large-file upload and automatic splitting design

### Goal

Allow users to import long audio, including one-hour recordings, and have the app automatically split, process, merge, save, and recover the transcript without uploading audio to a server.

### Current limitation

`transcriber.worker.ts` already uses bounded ASR windows, currently `WINDOW_SEC = 28` and `OVERLAP_SEC = 4`, which is good for inference memory. But `audio.ts` decodes the entire file with `file.arrayBuffer()`, `decodeAudioData()`, and `OfflineAudioContext.startRendering()` before the worker sees anything. That is the bottleneck for very large files.

### Recommended staged implementation

#### Phase 1: Long File Mode using current decoder

This is the safest first implementation because it preserves current Web Audio compatibility.

Add:

- `frontend/src/lib/longAudio.ts`
- `frontend/src/lib/chunkPlan.ts` or extend `chunker.ts`
- `frontend/src/components/LongFileOptions.tsx`
- `frontend/src/components/ChunkQueuePanel.tsx`
- `frontend/src/hooks/useLongTranscriber.ts` or extend `useTranscriber.ts` carefully

Behavior:

1. User selects audio.
2. App decodes once using existing `decodeAudioFile()`.
3. App creates macro chunks: 5-minute or 10-minute chunks.
4. Each macro chunk is sent to the existing worker as its own run with `offsetSec`.
5. Worker still internally uses 28-second overlapping windows.
6. Main thread receives each chunk result, merges by timestamp, saves partial progress, and frees chunk samples.
7. UI shows chunk queue and supports retry/resume.

This does not fully solve enormous decode-memory pressure, but it solves hour-long job visibility, queueing, partial persistence, and recovery.

#### Phase 2: Streaming/native chunk decode

To truly support much larger files on constrained Android devices, avoid whole-file PCM in memory.

Preferred paths:

- Browser/Web: use `WebCodecs AudioDecoder` where supported to stream decode compressed audio into PCM frames.
- Capacitor Android: add a native plugin using Android `MediaExtractor` + `MediaCodec` to decode time ranges into 16 kHz mono PCM chunks.
- Fallback: current Web Audio whole-file decode with a warning if file is too large.

Recommended compatibility policy:

```ts
export type DecodeMode = 'web-audio-whole-file' | 'webcodecs-streaming' | 'android-native-range';

export interface LongFilePlan {
  fileName: string;
  fileSize: number;
  durationSec: number;
  chunkSec: 300 | 600;
  overlapSec: number;
  decodeMode: DecodeMode;
  chunks: AudioMacroChunk[];
}

export interface AudioMacroChunk {
  id: string;
  index: number;
  startSec: number;
  endSec: number;
  status: 'queued' | 'decoding' | 'transcribing' | 'translating' | 'done' | 'error';
  error?: string;
}
```

### Chunk sizing rules

- Under 20 minutes: normal mode.
- 20-60 minutes: Long File Mode, 10-minute chunks by default.
- Over 60 minutes or low-memory device: Long File Mode, 5-minute chunks.
- Smart mode: cut near silence boundaries using existing VAD output when available.
- Preserve 2-5 seconds overlap between macro chunks and de-duplicate seams during merge.

### UX copy

Preflight card:

> Long file detected. We’ll split this into smaller local chunks, process them one at a time, and save progress after each chunk. Your audio still never leaves this device.

Chunk setting labels:

- `Auto — recommended`
- `5 min — safer on phones`
- `10 min — fewer chunks, more memory`
- `Smart silence — cut near pauses when possible`

Progress panel:

> Chunk 4 of 12 · Transcribing 15:00-20:00
> Completed chunks are saved automatically. You can resume if the app closes.

### Acceptance criteria

- Uploading a 60-minute audio file creates a visible chunk plan before transcription starts.
- User can choose 5-minute or 10-minute chunks.
- Progress panel shows chunk index, chunk time range, overall percent, ETA, and current phase.
- Partial results are saved after each chunk.
- Cancelling a long job keeps completed chunks and offers resume/restart.
- Merged transcript preserves global timestamps.
- Region re-run still works after a chunked transcription.
- Export output is identical in structure to normal mode.

---

## Theme system design

### Goal

Add four selectable themes reachable from a small palette button beside the Library button in the header.

Themes:

1. **Azure Glass** — current look, default.
2. **Darker Mode** — deeper black/blue, lower glow, stronger contrast.
3. **Corporate Cream** — warm cream background, readable dark text, restrained blue accent.
4. **Brutalist Mode** — hard edges, high-contrast blocks, minimal glow, heavy borders.

### Implementation files

Add:

- `frontend/src/lib/themes.ts`
- `frontend/src/components/ThemePicker.tsx`

Modify:

- `frontend/src/App.tsx`
- `frontend/src/index.css`

### Theme model

```ts
export type ThemeId = 'azure' | 'darker' | 'cream' | 'brutalist';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  description: string;
  swatches: string[];
}

export const THEME_STORAGE_KEY = 'spanish-whisper-theme';

export const themes: ThemeOption[] = [
  {
    id: 'azure',
    name: 'Azure Glass',
    description: 'Current blue-glow interface.',
    swatches: ['#050912', '#0ea5e9', '#38bdf8', '#e8eefc'],
  },
  {
    id: 'darker',
    name: 'Darker',
    description: 'Blackened low-glow transcription room.',
    swatches: ['#010205', '#111827', '#60a5fa', '#f8fafc'],
  },
  {
    id: 'cream',
    name: 'Corporate Cream',
    description: 'Warm document workspace.',
    swatches: ['#f6efe1', '#1f2937', '#2563eb', '#92400e'],
  },
  {
    id: 'brutalist',
    name: 'Brutalist',
    description: 'Hard borders, blunt contrast, no mist.',
    swatches: ['#f5f5f0', '#0a0a0a', '#ffcc00', '#ff3b30'],
  },
];
```

### CSS approach

Use `html[data-theme="..."]` or `body[data-theme="..."]` and override the existing semantic tokens. This app already has the correct foundation because components increasingly use variables like `--text`, `--text-muted`, `--accent-bg`, `--border`, `--warn`, and `--trans`.

Example:

```css
html[data-theme='darker'] {
  --ink-950: #010205;
  --ink-900: #060914;
  --glass-bg: rgba(255, 255, 255, 0.035);
  --glass-bg-strong: rgba(255, 255, 255, 0.06);
  --glass-border: rgba(148, 163, 184, 0.16);
  --text: #f8fafc;
  --text-muted: #cbd5e1;
  --text-subtle: #94a3b8;
  --accent: #2563eb;
  --accent-bright: #60a5fa;
  --accent-bg: rgba(37, 99, 235, 0.16);
  --accent-border: rgba(96, 165, 250, 0.42);
}

html[data-theme='cream'] {
  --ink-950: #f6efe1;
  --ink-900: #fffaf0;
  --glass-bg: rgba(255, 255, 255, 0.72);
  --glass-bg-strong: rgba(255, 255, 255, 0.88);
  --glass-border: rgba(120, 85, 45, 0.22);
  --text: #1f2937;
  --text-muted: #4b5563;
  --text-subtle: #6b7280;
  --accent: #2563eb;
  --accent-bright: #1d4ed8;
  --accent-bg: rgba(37, 99, 235, 0.12);
  --accent-border: rgba(37, 99, 235, 0.32);
}

html[data-theme='brutalist'] {
  --ink-950: #f5f5f0;
  --ink-900: #f5f5f0;
  --glass-bg: #ffffff;
  --glass-bg-strong: #ffffff;
  --glass-border: #0a0a0a;
  --glass-border-strong: #0a0a0a;
  --text: #0a0a0a;
  --text-muted: #111111;
  --text-subtle: #333333;
  --accent: #ffcc00;
  --accent-bright: #ffcc00;
  --accent-bg: #ffcc00;
  --accent-border: #0a0a0a;
}

html[data-theme='brutalist'] .glass,
html[data-theme='brutalist'] .glass-strong {
  border-width: 2px;
  border-radius: 0.375rem;
  box-shadow: 6px 6px 0 #0a0a0a;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
```

### ThemePicker behavior

- Header button next to Library.
- Icon: `Palette` from `lucide-react`.
- `aria-haspopup="dialog"` or `aria-haspopup="menu"`.
- Popover opens downward/right on desktop, full-width sheet on small screens.
- Each theme card has visible name, short description, four swatches, active checkmark.
- Selecting a theme immediately applies it and writes localStorage.
- Escape closes picker.
- Focus returns to trigger when closed.

### Acceptance criteria

- Four themes are selectable from the header.
- Theme persists across reloads.
- Theme applies before or immediately on first render without a long flash.
- All existing core states remain readable: idle, file selected, progress, error, done, modal, library, transcript, translation, export.
- Brutalist disables glow/blur effects and uses square/hard bordered surfaces.
- Corporate Cream does not leave hardcoded white/sky text unreadable.

---

## Build validation checklist

Run from `frontend/`:

```bash
npm install
npm run build
npm run test
```

Manual QA:

- Select a short file and run normal transcription.
- Select or simulate a long file and verify Long File Mode preflight.
- Switch chunk sizes before run.
- Cancel during chunk processing and verify partial recovery UX.
- Switch all 4 themes in idle, progress, result, library modal, and FAQ modal.
- Check keyboard focus order: header buttons, upload controls, model select, advanced options, start button, modals/popover.
- Test reduced motion: theme popover should not rely on motion to be understandable.

---

## Implementation priority

1. Theme system first. It is mostly token work and exposes current hardcoded color debt.
2. Chunk preflight UI second. It gives users confidence even before streaming decode exists.
3. Long File Mode queue third using current decoder.
4. Native/streaming decode fourth for true huge-file resilience.

Do not rewrite the app around a backend. The product promise is local/offline/no server, and the current architecture is already built around that promise.
