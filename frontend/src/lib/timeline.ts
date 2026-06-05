export interface TimedRange {
  start: number;
  end: number;
}

export interface TimedText extends TimedRange {
  id: string;
  text: string;
}

export function normalizeRange(range: TimedRange): TimedRange {
  return {
    start: Math.min(range.start, range.end),
    end: Math.max(range.start, range.end),
  };
}

export function replaceTimedRange<T extends TimedText>(
  items: T[],
  replacements: T[],
  range: TimedRange,
  idPrefix: string
): T[] {
  const normalized = normalizeRange(range);
  const kept = items.filter((item) => item.end <= normalized.start || item.start >= normalized.end);
  const merged = [...kept, ...replacements].sort((a, b) => a.start - b.start);

  return merged.map((item, index) => ({
    ...item,
    id: `${idPrefix}-${index}`,
  }));
}
