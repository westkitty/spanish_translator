# Offline Cross-Platform English-Spanish Translator

A standalone, fully offline English ↔ Spanish translation application optimized for mobile viewports. The system runs completely client-side without relying on external servers, backend APIs, or remote translation services after the initial load.

## 🚀 Key Features

*   **Offline-First Inference:** Runs machine translation models locally in the client using **Transformers.js** (ONNX Runtime WebAssembly).
*   **Smooth Mobile UI (60 FPS):** Model inference executes inside a background **Web Worker** to prevent blocking the main rendering thread.
*   **Quantized Model Footprint:** Uses 8-bit quantized models (`Xenova/opus-mt-en-es` and `Xenova/opus-mt-es-en`), keeping the load weight under 75MB.
*   **IndexedDB Caching:** Once downloaded on first launch, model files are permanently cached inside the device's IndexedDB, operating fully offline thereafter.
*   **Native Cross-Platform wrappers:** Integrated with **Capacitor 6** to target native iOS and Android environments.

---

## 🛠️ System Configurations for WebAssembly over Native Containers

Running WebAssembly and local model caching inside native mobile containers (like Capacitor Webviews) requires strict origin controls and security parameters. This project applies the following non-negotiable setups:

1.  **Origin Schema Isolation:** In `capacitor.config.json`, the standard local webview scheme is routed over `https://localhost`. This satisfies modern secure-context specifications, enabling **WebAssembly memory allocations** and **IndexedDB** caching inside native wrappers.
2.  **ONNX WASM Binary Locator:** Capacitor webviews cannot resolve standard dynamic path mappings for ONNX runtime WebAssembly binaries. We explicitly anchor the configuration paths (`env.backends.onnx.wasm.wasmPaths`) inside `src/workers/translator.worker.ts` to fetch runtime binary modules from a secure CDN fallback if local system mappings fail.
3.  **CORS Header Optimization:** Vite dev server is configured with strict Cross-Origin-Opener-Policy (`same-origin`) and Cross-Origin-Embedder-Policy (`require-corp`) headers to support SharedArrayBuffer allocations.

---

## 💻 Getting Started (Web & Development)

### Prerequisites

*   Node.js (v18+)
*   NPM

### Installation & Run

1.  Clone the repository and install dependencies:
    ```bash
    npm install
    ```

2.  Run the application in local development mode:
    ```bash
    npm run dev
    ```
    Open `http://localhost:5173/` in your browser.

3.  Build the production web assets:
    ```bash
    npm run build
    ```
    This compiles assets into the `/dist` directory, which Capacitor uses to bundle the native mobile applications.

---

## 📱 Mobile Platform Compilation

### 🤖 Android Setup & Build

1.  Synchronize the web build with the Android project:
    ```bash
    npx cap sync android
    ```

2.  Compile the debug APK directly from your terminal:
    ```bash
    cd android && ./gradlew assembleDebug
    ```
    The compiled package will be located at:  
    `android/app/build/outputs/apk/debug/app-debug.apk`

3.  Open the project in Android Studio if you want to deploy to a connected device:
    ```bash
    npx cap open android
    ```

---

### 🍎 iOS Setup & Build

1.  Verify CocoaPods is installed, then sync the web build:
    ```bash
    npx cap sync ios
    ```

2.  Open the project inside Xcode:
    ```bash
    npx cap open ios
    ```

3.  Inside Xcode:
    *   Select your target device or simulator.
    *   Click the **Play/Run** button to compile and install on your device.
    *   *Note:* If compiling on simulators raises an error stating the SDK runtime is missing, open Xcode, navigate to `Xcode > Settings > Components`, and download the requested platform runtime (e.g., iOS 17/18).
