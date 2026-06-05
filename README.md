# Spanish Whisper Engine — On-Device Audio Transcription

A fully **offline, on-device** Spanish audio transcription app. Pick an audio file,
and Whisper runs **inside the app** (no server, no API, no uploads) to produce a
word-timestamped Spanish transcript **and** an English translation — automatically,
every run. Scrub, edit, and export both.

## How it works

- **On-device Whisper** via [Transformers.js](https://github.com/huggingface/transformers.js)
  (ONNX Runtime / WebAssembly). The audio never leaves the device.
- **No backend.** There is no server to run. The previous FastAPI/mock backend has
  been removed entirely — all inference happens in the WebView.
- **Audio pipeline:** the file is decoded to 16 kHz mono PCM with the Web Audio API,
  then transcribed in a Web Worker so the UI stays responsive.
- **Offline after first run:** the model (~45–85 MB) downloads once from the Hugging
  Face hub and is cached in the browser Cache API. The ONNX runtime itself is bundled
  in the app. After the first transcription, no network is ever needed.

## Models & footprint

The model is chosen by a **quality tier**. Each tier downloads once and is cached
independently, so switching tiers only downloads the new one.

| Tier | Model | Backend | On-device size |
|------|-------|---------|----------------|
| Fast | `Xenova/whisper-tiny` | WASM / WebGPU | ~45 MB |
| Balanced (default) | `Xenova/whisper-base` | WASM / WebGPU | ~85 MB |
| Accurate (recommended) | `Xenova/whisper-small` | WASM / WebGPU | ~250 MB |
| Best | `onnx-community/whisper-large-v3-turbo` | **WebGPU only** | large |

**Quantization is per-backend** (see `src/lib/models.ts`):

- **WASM/CPU** (universal fallback): the quantization-sensitive **encoder runs at
  fp32**, the tolerant decoder at q8. Keeping the encoder full-precision is the
  single biggest accuracy fix — q8 on the encoder was the previous default and
  badly degraded Spanish recognition.
- **WebGPU** (when the device supports it): **fp16** throughout — faster and far
  more accurate than q8, which is what makes the Accurate/Best tiers practical.

The **Best** tier is only offered on WebGPU-capable devices (recent Android 12+
Chromium WebView / desktop Chrome, Firefox, Safari, Edge).

Total installed footprint is roughly **~100 MB** with the Balanced tier (app +
ONNX runtime + base model), more with larger tiers.

Each run does **two passes on the same loaded model** (no extra download, no extra
storage):

- **Pass 1 — Spanish transcript:** `task: transcribe` → word-level Spanish text that
  drives the timeline and editor.
- **Pass 2 — English translation:** `task: translate` → segment-level English shown
  in a read-only panel and included in every export.

## Project structure

```
frontend/
├── src/
│   ├── App.tsx                       # UI: file pick → transcribe → edit → export
│   ├── lib/
│   │   ├── audio.ts                  # File → 16 kHz mono PCM (Web Audio API)
│   │   └── transcriber.worker.ts     # Whisper inference Web Worker (Transformers.js)
│   ├── hooks/
│   │   ├── useTranscriber.ts         # Decode + worker orchestration + progress
│   │   └── useAudioPlayer.ts         # Playback synced to the timeline
│   └── components/
│       ├── AudioCanvas.tsx           # Waveform / scrub timeline
│       ├── CaptionEditor.tsx         # Virtualized Spanish word editor
│       ├── TranslationPanel.tsx      # Read-only English translation (click to seek)
│       └── CaptionExport.tsx         # TXT / timed-JSON / clipboard (transcript + translation)
├── android/                          # Capacitor Android project
└── capacitor.config.ts
```

## Getting started (web / development)

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
```

Build the production web assets:

```bash
npm run build    # outputs to frontend/dist
```

## Android build

```bash
cd frontend
npm run build
npx cap sync android
cd android && ./gradlew assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```

> **Note:** `npx cap sync` regenerates `android/app/capacitor.build.gradle` targeting
> Java 21. If you build with JDK 17, reset its `sourceCompatibility`/`targetCompatibility`
> to `VERSION_17` before `assembleRelease`.

## First-run requirement

The very first transcription needs internet **once** to download the Whisper model
(~85 MB for base). After that the app is fully offline forever. There is no server
to set up — ever.
