# Offline Cross-Platform English-Spanish Translator - Development Plan

This document details the folder structure and step-by-step development process for the fully offline translation application.

## Directory Structure

```
/Users/andrew/Spanish offline transliter./
├── capacitor.config.json       # Capacitor configuration
├── package.json                # Project dependencies (Capacitor, React, Transformers)
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite + WASM worker configuration
├── tailwind.config.js          # Tailwind styling rules
├── postcss.config.js           # PostCSS configuration
│
└── src/
    ├── main.tsx                # App entry
    ├── index.css               # Tailwind & font imports
    ├── App.tsx                 # Main layout & Web Worker management
    │
    ├── components/
    │   ├── Header.tsx          # Direction toggles
    │   ├── TranslationBox.tsx # Inputs, outputs & copy logic
    │   └── StatusIndicator.tsx # Model download percentage and status tracking
    │
    └── workers/
        └── translator.worker.ts # Transformers.js ONNX inference Web Worker
```

## Step-by-Step Execution Plan

### Phase 1: Setup & Configuration
1. Initialize `package.json` with dependencies (React, Vite, Tailwind CSS, Transformers.js, Capacitor CLI).
2. Configure TypeScript (`tsconfig.json`) and PostCSS.
3. Configure Vite (`vite.config.ts`) to handle WASM assets and Web Worker bundles.
4. Setup Capacitor (`capacitor.config.json`).

### Phase 2: Web Worker & Translation Engine
1. Implement `translator.worker.ts` with Xenova Transformers pipeline logic.
2. Setup IndexedDB caching so the translation model runs completely offline once loaded.
3. Propagate progress tracking back to the main thread during model initialization.

### Phase 3: React Frontend Components
1. Construct components: `Header.tsx`, `TranslationBox.tsx`, `StatusIndicator.tsx`.
2. Assemble `App.tsx` connecting state to the worker. Ensure it handles window/view states, layouts, and touch interactions.
3. Polish styles for touch-first mobile viewports (iOS Safari and Android Chrome).

### Phase 4: Build & Mobile Setup
1. Compile the code (`npm run build`) to produce the static output directory `/dist`.
2. Run Capacitor setup (`npx cap add ios` and `npx cap add android`) to prepare the native workspaces.
3. Verify worker initialization and offline execution in a mock/simulated environment.
