import { pipeline, env } from '@huggingface/transformers';

// Mobile file:// and internal protocol configuration guards
env.allowLocalModels = false;
env.useBrowserCache = true;

// Explicitly anchor the ONNX WASM distribution paths outside of local scope bounds
if (env.backends && env.backends.onnx && env.backends.onnx.wasm) {
  env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/dist/';
}

let pipelines: Record<string, any> = {
  'en-es': null,
  'es-en': null
};

async function getTranslationPipeline(pair: 'en-es' | 'es-en', progressCallback: (data: any) => void) {
  if (pipelines[pair]) return pipelines[pair];

  const modelMap = {
    'en-es': 'Xenova/opus-mt-en-es',
    'es-en': 'Xenova/opus-mt-es-en'
  };

  pipelines[pair] = await pipeline('translation', modelMap[pair], {
    device: 'wasm',
    dtype: 'q8', // Force 8-bit quantization for minimal mobile RAM exhaustion
    progress_callback: progressCallback
  });

  return pipelines[pair];
}

self.addEventListener('message', async (event: MessageEvent) => {
  const { text, mode, action } = event.data;

  if (action === 'warm') {
    try {
      await getTranslationPipeline(mode, (progressData: any) => {
        if (progressData.status === 'progress') {
          self.postMessage({ status: 'progress', progress: progressData.progress, file: progressData.file });
        }
      });
      self.postMessage({ status: 'ready', mode });
    } catch (err: any) {
      self.postMessage({ status: 'error', error: err.message });
    }
    return;
  }

  if (action === 'translate') {
    try {
      const translator = await getTranslationPipeline(mode, () => {});
      const output = await translator(text, {
        max_new_tokens: 512,
        temperature: 0.0 // Force absolute greedy decoding for factual accuracy stability
      });

      self.postMessage({ status: 'completed', translation: output[0].translation_text });
    } catch (err: any) {
      self.postMessage({ status: 'error', error: err.message });
    }
  }
});
