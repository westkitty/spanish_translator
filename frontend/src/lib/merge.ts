// Merges per-window transcription results back into one continuous, de-duplicated,
// time-ordered list. Each window's item timestamps are relative to the window
// slice, so we offset them by the window's absolute start. Overlap regions are
// de-duplicated by assigning each item to exactly one window: items whose center
// falls before the overlap midpoint belong to the earlier window, items after it
// to the later window.

import type { Window } from './chunker';

export interface TimedItem {
  text: string;
  start: number;
  end: number;
}

export function mergeWindowed(perWindow: TimedItem[][], windows: Window[]): TimedItem[] {
  const out: TimedItem[] = [];

  for (let k = 0; k < windows.length; k++) {
    const w = windows[k];
    const items = perWindow[k] ?? [];
    const offset = w.startSec;

    // Lower bound: midpoint of overlap with the previous window (if any).
    let lowerBound = -Infinity;
    if (k > 0) {
      const prev = windows[k - 1];
      lowerBound = (w.startSec + prev.endSec) / 2;
    }

    // Upper bound: midpoint of overlap with the next window (if any).
    let upperBound = Infinity;
    if (k < windows.length - 1) {
      const next = windows[k + 1];
      upperBound = (next.startSec + w.endSec) / 2;
    }

    for (const it of items) {
      const start = it.start + offset;
      const end = it.end + offset;
      const center = (start + end) / 2;
      if (center < lowerBound || center >= upperBound) continue;
      out.push({ text: it.text, start, end });
    }
  }

  out.sort((a, b) => a.start - b.start);
  return out;
}
