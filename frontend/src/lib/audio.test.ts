import { describe, expect, it } from 'vitest';
import { encodeWav } from './audio';

describe('encodeWav', () => {
  it('writes a mono PCM WAV header', async () => {
    const wav = encodeWav(new Float32Array([0, 1, -1]), 16000);
    const bytes = new Uint8Array(await wav.arrayBuffer());
    const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
    const view = new DataView(bytes.buffer);

    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 12)).toBe('WAVE');
    expect(text(36, 40)).toBe('data');
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint32(40, true)).toBe(6);
  });
});
