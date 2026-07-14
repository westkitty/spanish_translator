export const MAX_AUDIO_FILE_BYTES = 200 * 1024 * 1024;

const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'ogg', 'oga', 'webm', 'aac', 'flac', 'mp4']);

export function validateAudioFile(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  if (file.size <= 0) return 'This audio file is empty.';
  if (file.size > MAX_AUDIO_FILE_BYTES) {
    return 'This file exceeds the 200 MB upload limit. Long recordings may also exceed this device’s available memory.';
  }
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const looksLikeAudio = file.type.startsWith('audio/') || AUDIO_EXTENSIONS.has(extension);
  if (!looksLikeAudio) return 'Choose an audio file such as MP3, WAV, M4A, OGG, WebM, AAC, or FLAC.';
  return null;
}

export function formatTranscriptText(words: ReadonlyArray<{ text: string }>): string {
  return words
    .map((word) => word.text.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+([,.;:!?%\)\]\}])/g, '$1')
    .replace(/([\(\[\{¿¡])\s+/g, '$1')
    .replace(/\s+(['’])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
