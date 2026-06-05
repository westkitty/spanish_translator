// Merges per-window transcription results back into one continuous, de-duplicated,
// time-ordered list. Each window's item timestamps are relative to the window
// slice, so we offset them by the window's absolute start. Overlap regions are
// de-duplicated by assigning each item to exactly one window via a cut point:
// items whose center falls before the cut belong to the earlier window, items
// after it to the later window.
//
// By default the cut is the overlap MIDPOINT. Callers may instead pass explicit
// cut points (see `silenceAwareCuts`) so the handoff lands in a silence rather
// than the middle of a word.

import type { Window } from './chunker';

export interface TimedItem {
  text: string;
  start: number;
  end: number;
}

export interface SilenceRange {
  start: number;
  end: number;
}

/**
 * @param cutPoints Optional absolute-second boundaries, length `windows.length - 1`.
 *                  `cutPoints[k]` is the handoff between window k and k+1. When
 *                  omitted, the overlap midpoint is used.
 */
export function mergeWindowed(
  perWindow: TimedItem[][],
  windows: Window[],
  cutPoints?: number[]
): TimedItem[] {
  const out: TimedItem[] = [];

  for (let k = 0; k < windows.length; k++) {
    const w = windows[k];
    const items = perWindow[k] ?? [];
    const offset = w.startSec;

    // Lower bound: handoff with the previous window (if any).
    let lowerBound = -Infinity;
    if (k > 0) {
      const prev = windows[k - 1];
      lowerBound = cutPoints?.[k - 1] ?? (w.startSec + prev.endSec) / 2;
    }

    // Upper bound: handoff with the next window (if any).
    let upperBound = Infinity;
    if (k < windows.length - 1) {
      const next = windows[k + 1];
      upperBound = cutPoints?.[k] ?? (next.startSec + w.endSec) / 2;
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

/**
 * Compute silence-aware cut points for adjacent windows. For each overlap, if a
 * silence overlaps the overlap region and its center is within `maxShiftSec` of
 * the nominal midpoint, the cut snaps to that silence center (so the window
 * handoff falls between words). Otherwise the nominal midpoint is kept.
 */
export function silenceAwareCuts(
  windows: Window[],
  silences: SilenceRange[],
  maxShiftSec = 2
): number[] {
  const cuts: number[] = [];
  for (let k = 0; k < windows.length - 1; k++) {
    const w = windows[k];
    const next = windows[k + 1];
    const overlapStart = next.startSec;
    const overlapEnd = w.endSec;
    const nominal = (overlapStart + overlapEnd) / 2;

    let best: number | null = null;
    let bestDist = Infinity;
    for (const s of silences) {
      // Silence must intersect the overlap window.
      if (s.end <= overlapStart || s.start >= overlapEnd) continue;
      const center = Math.min(Math.max((s.start + s.end) / 2, overlapStart), overlapEnd);
      const dist = Math.abs(center - nominal);
      if (dist < bestDist) {
        bestDist = dist;
        best = center;
      }
    }

    cuts.push(best !== null && bestDist <= maxShiftSec ? best : nominal);
  }
  return cuts;
}
