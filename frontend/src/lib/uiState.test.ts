import { describe, expect, it } from 'vitest';
import { formatTranscriptText, MAX_AUDIO_FILE_BYTES, validateAudioFile } from './uiState';

describe('validateAudioFile', () => {
  it('rejects empty and oversized files', () => {
    expect(validateAudioFile({ name: 'empty.wav', size: 0, type: 'audio/wav' })).toContain('empty');
    expect(validateAudioFile({ name: 'huge.mp3', size: MAX_AUDIO_FILE_BYTES + 1, type: 'audio/mpeg' })).toContain('200 MB');
  });

  it('accepts audio MIME types and known audio extensions', () => {
    expect(validateAudioFile({ name: 'speech.bin', size: 10, type: 'audio/mpeg' })).toBeNull();
    expect(validateAudioFile({ name: 'speech.m4a', size: 10, type: '' })).toBeNull();
  });

  it('rejects obvious non-audio files', () => {
    expect(validateAudioFile({ name: 'notes.txt', size: 10, type: 'text/plain' })).toContain('audio file');
  });
});

describe('formatTranscriptText', () => {
  it('does not insert spaces before punctuation', () => {
    const words = ['Hola', ',', 'mundo', '!', '¿', 'Cómo', 'estás', '?'].map((text) => ({ text }));
    expect(formatTranscriptText(words)).toBe('Hola, mundo! ¿Cómo estás?');
  });
});
