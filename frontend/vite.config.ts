import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Fully client-side, on-device app — there is no backend server to proxy to.
// Transformers.js + ONNX Runtime run inside the WebView; models are cached locally.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5183,
  },
  // Transformers.js / onnxruntime-web ship large prebuilt bundles that Vite's dep
  // optimizer shouldn't try to pre-bundle.
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
  build: {
    target: 'es2022',
  },
});
