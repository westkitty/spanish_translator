// Restores Spanish opening punctuation (¿ ¡). Whisper emits the closing mark
// (?, !) but usually omits the opening inverted mark that Spanish requires.
// Operates on a single reconstructed sentence; pure and idempotent.

/** Add a leading ¿ / ¡ to a sentence that ends in ? / ! and lacks one. */
export function restoreInvertedMarks(text: string): string {
  if (text.trim() === '') return text;

  // Inspect the trailing run of terminal marks. A question mark anywhere in it
  // wins (e.g. "?!" -> ¿), otherwise an exclamation.
  const trimmedEnd = text.replace(/\s+$/, '');
  const tail = trimmedEnd.match(/[?!¿¡…]+$/)?.[0] ?? '';

  let openMark: string | null = null;
  if (tail.includes('?')) openMark = '¿';
  else if (tail.includes('!')) openMark = '¡';
  if (!openMark) return text;

  // Find the first non-space character; if it's already an inverted mark, stop.
  const leadMatch = text.match(/^(\s*)(.*)$/s);
  const lead = leadMatch?.[1] ?? '';
  const rest = leadMatch?.[2] ?? text;
  if (rest.startsWith('¿') || rest.startsWith('¡')) return text;

  return lead + openMark + rest;
}
