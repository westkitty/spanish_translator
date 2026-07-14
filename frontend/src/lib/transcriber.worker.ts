/// <reference lib="webworker" />
// On-device Whisper inference worker. Loads a quantized Whisper model via
// Transformers.js (ONNX Runtime / WASM) and processes the audio in bounded,
// overlapping WINDOWS — one at a time — so long files never exhaust memory.
// After each window it reports the wall-clock time it took,