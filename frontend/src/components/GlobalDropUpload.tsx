import { useEffect, useRef, useState } from 'react';
import { FileAudio } from 'lucide-react';
import { notify } from '../lib/toast';
import { validateAudioFile } from '../lib/uiState';

function getAudioFile(event: DragEvent): File | null {
  const files = Array.from(event.dataTransfer?.files ?? []);
  return files.find((file) => file.type.startsWith('audio/')) ?? files[0] ?? null;
}

function setFileInput(file: File): boolean {
  const input = document.querySelector<HTMLInputElement>('input[type="file"][accept="audio/*"]');
  if (!input) return false;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

export function GlobalDropUpload() {
  const [active, setActive] = useState(false);
  const depth = useRef(0);

  useEffect(() => {
    const onDragEnter = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      depth.current += 1;
      setActive(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    };
    const onDragLeave = () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setActive(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      depth.current = 0;
      setActive(false);
      const file = getAudioFile(event);
      if (!file) { notify('Drop an audio file to import it.', 'warning'); return; }
      const validationError = validateAudioFile(file);
      if (validationError) { notify(validationError, 'warning'); return; }
      const loaded = setFileInput(file);
      notify(loaded ? `Loaded ${file.name}` : 'Open the file-import view before dropping audio.', loaded ? 'success' : 'warning');
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  if (!active) return null;
  return <div className="drop-upload-overlay" aria-hidden="true"><div className="drop-upload-overlay__card glass-strong"><FileAudio className="w-8 h-8" /><p>Drop audio to import</p><span>Common audio formats up to 200 MB. Processing happens on this device.</span></div></div>;
}
