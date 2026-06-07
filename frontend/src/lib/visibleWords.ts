// Selects which caption words the inline editor renders for the current playback
// position. The editor virtualizes by time (a moving window around `currentTime`)
// so a long transcript stays light. But the transcript is the product: it must
// NEVER disappear just because the audio clock is unusable.
//
// Two ways the naive window-filter failed in the field, both producing a fully
// blank transcript even though every word was present:
//   1. `currentTime` is non-finite (NaN) — happens when the WebView's <audio>
//      element can't load the picked source, so its clock never becomes valid.
//      `w.start <= NaN` is false for every word → empty window.
//   2. `currentTime` sits in a stretch with no word starts in range.
// In both cases we fall back to the words nearest the (sanitized) position so the
// user always sees readable text and can scroll/seek from there.

export interface TimedWord {
  start: number;
  end: number;
}

export interface VisibleWindow {
  start: number;
  end: number;
}

/** Sanitize the playback clock: anything non-finite (NaN/±Infinity) becomes 0. */
export function safePlayhead(currentTime: number): number {
  return Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0;
}

/**
 * Words visible for `currentTime`, given a window of `windowSize` seconds starting
 * `windowOffset` seconds before the playhead. Guarantees a non-empty result
 * whenever `words` is non-empty: if the time window catches nothing, it anchors to
 * the word nearest the playhead and returns a window around that instead.
 */
export function selectVisibleWords<T extends TimedWord>(
  words: T[],
  currentTime: number,
  windowSize: number,
  windowOffset: number
): T[] {
  if (words.length === 0) return [];

  const playhead = safePlayhead(currentTime);
  const start = Math.max(0, playhead + windowOffset);
  const end = start + windowSize;

  const inWindow = words.filter((w) => w.end >= start && w.start <= end);
  if (inWindow.length > 0) return inWindow;

  // Nothing in range — anchor to the nearest word so the transcript stays visible.
  let nearestIdx = 0;
  let nearestDist = Infinity;
  for (let i = 0; i < words.length; i++) {
    const dist = Math.min(
      Math.abs(words[i].start - playhead),
      Math.abs(words[i].end - playhead)
    );
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestIdx = i;
    }
  }

  const anchor = words[nearestIdx].start;
  const half = windowSize / 2;
  const aStart = anchor - half;
  const aEnd = anchor + half;
  const anchored = words.filter((w) => w.end >= aStart && w.start <= aEnd);
  // Guard against pathological timestamps (e.g. all identical): always yield ≥1.
  return anchored.length > 0 ? anchored : [words[nearestIdx]];
}
