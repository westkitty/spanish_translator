import { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import TranslationBox from './components/TranslationBox';
import StatusIndicator from './components/StatusIndicator';

export default function App() {
  const [sourceText, setSourceText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [isEnglishToSpanish, setIsEnglishToSpanish] = useState(true);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [activeFile, setActiveFile] = useState<string>('');
  
  const workerRef = useRef<Worker | null>(null);

  const currentMode = isEnglishToSpanish ? 'en-es' : 'es-en';

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('./workers/translator.worker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.onmessage = (event) => {
      const { status: workerStatus, progress, file, translation, error } = event.data;

      if (workerStatus === 'progress') {
        setStatus('loading');
        setDownloadProgress(Math.round(progress));
        if (file) setActiveFile(file);
      } else if (workerStatus === 'ready') {
        setStatus('ready');
      } else if (workerStatus === 'completed') {
        setTargetText(translation);
      } else if (workerStatus === 'error') {
        setStatus('error');
        console.error(error);
      }
    };

    // Warm up the translation pipeline immediately on load
    workerRef.current.postMessage({ action: 'warm', mode: currentMode });

    return () => {
      workerRef.current?.terminate();
    };
  }, [currentMode]);

  const handleTranslate = (text: string) => {
    setSourceText(text);
    if (!text.trim()) {
      setTargetText('');
      return;
    }
    if (status === 'ready' && workerRef.current) {
      workerRef.current.postMessage({
        action: 'translate',
        text: text,
        mode: currentMode
      });
    }
  };

  const handleToggleMode = () => {
    setIsEnglishToSpanish(!isEnglishToSpanish);
    setSourceText('');
    setTargetText('');
    setStatus('idle');
    setDownloadProgress(0);
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 max-w-md mx-auto">
      <Header 
        isEnglishToSpanish={isEnglishToSpanish} 
        onToggle={handleToggleMode} 
        onClear={() => { setSourceText(''); setTargetText(''); }}
      />
      
      <main className="w-full mt-6 space-y-4 flex-grow">
        <TranslationBox
          label={isEnglishToSpanish ? "English" : "Spanish"}
          placeholder={isEnglishToSpanish ? "Type english phrase..." : "Escriba texto en español..."}
          value={sourceText}
          onChange={handleTranslate}
          isReadOnly={false}
        />

        <TranslationBox
          label={isEnglishToSpanish ? "Spanish" : "English"}
          placeholder="Translation output will appear here..."
          value={targetText}
          onChange={() => {}}
          isReadOnly={true}
        />
      </main>

      <footer className="w-full mt-auto pt-6">
        <StatusIndicator 
          status={status} 
          progress={downloadProgress} 
          fileName={activeFile}
        />
      </footer>
    </div>
  );
}
