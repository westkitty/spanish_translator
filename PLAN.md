# Mobile-First Spanish Audio Transcription & Caption Engine - Development Plan

This document details the folder structure and step-by-step development process for the fully offline audio transcription and caption editing application.

## Directory Structure

```
/Users/andrew/Spanish offline transliter./
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py             # FastAPI App, local db state & upload endpoints
│   │   ├── config.py           # Application Settings (Offline configurations)
│   │   ├── tasks.py            # Local Background Tasks (audio processing, merging, silence)
│   │   ├── audio_utils.py      # FFmpeg wrappers (downsampling, overlapping slice, silence)
│   │   └── transcription.py    # Pluggable local offline transcription engine
│   ├── tests/
│   │   └── test_merge.py       # Timestamp offset merge verification
│   └── requirements.txt        # Python Packages
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AudioCanvas.tsx    # HTML5 Canvas visual audio wave & scrubbing
│   │   │   ├── CaptionEditor.tsx  # Virtualized list of visible words & input box
│   │   │   ├── FileSelector.tsx   # Mobile chunk file upload, localStorage cache, retry
│   │   │   └── CaptionExport.tsx  # SRT/VTT/JSON caption export
│   │   ├── hooks/
│   │   │   ├── useAudioPlayer.ts  # Playback syncing to visual canvas position
│   │   │   └── useChunkUploader.ts# Blob.slice upload loop & state tracking
│   │   ├── App.tsx             # Responsive touch-first container
│   │   ├── index.css           # CSS variables, Tailwind styles & custom scrollbars
│   │   └── main.tsx            # React 19 entry
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── vite.config.ts
│
└── PLAN.md                     # This Plan File
```

## Step-by-Step Execution Plan

### Phase 1: Setup & Backend Foundations
1. Initialize `/backend` folder structure.
2. Implement local database state tracking using SQLite/SQLAlchemy to keep track of uploaded chunks and background worker status.
3. Write `audio_utils.py` incorporating FFmpeg commands for downsampling to 16kHz WAV mono, silence detection, and 20-minute chunk slicing with a 10-second overlap.

### Phase 2: Transcription Engine & Boundary Merging
1. Develop `transcription.py` containing:
   - A pluggable local model loader.
   - An offline mock translation generator that parses audio files and generates detailed word-level timestamp Spanish texts, matching silence ranges to filter out hallucinations.
2. Write merging arithmetic in `tasks.py` to compile chunks across the 10-second boundaries by tracking rolling time offsets.
3. Build FastAPI endpoints for chunked uploading, job triggering, and progress tracking in `main.py`.

### Phase 3: Frontend Foundations & Ingestion
1. Initialize `/frontend` using React 19 + TypeScript + Tailwind CSS (via PostCSS).
2. Develop the chunk uploader hook (`useChunkUploader.ts`) using the client-side `Blob.slice()` API. Ensure it tracks and caches upload indices in `localStorage` to resume from network interruptions.

### Phase 4: Touch Canvas Timeline & Virtual Editor
1. Create `AudioCanvas.tsx` utilizing HTML5 Canvas to render the audio wave ribbon and handle swipe scrubbing events.
2. Develop `CaptionEditor.tsx` implementing virtual text rendering to display only words that fall within the active timeline viewport.
3. Hook up native mobile keyboard inputs and configure caption exports for SRT, VTT, and JSON.

### Phase 5: Integration & Verification
1. Run local integration checks between backend and frontend.
2. Conduct QA testing on mock viewports.
