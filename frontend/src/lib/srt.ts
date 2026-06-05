// Timestamp formatting for subtitle formats.
//  - SRT uses a comma before milliseconds:  00:01:02,500
//  - VTT uses a dot:                          00:01:02.500

export function formatTimestamp(totalSeconds: number, sep: ',' | '.' = ','): string {
  const clamped = Math.max(0, totalSeconds);
  const ms = Math.round((clamped - Math.floor(clamped)) * 1000);
  let whole = Math.floor(clamped);
  // Carry rounded milliseconds (e.g. 1.9996 -> 2.000).
  const msFixed = ms === 1000 ? 0 : ms;
  if (ms === 1000) whole += 1;

  const hh = Math.floor(whole / 3600);
  const mm = Math.floor((whole % 3600) / 60);
  const ss = whole % 60;

  const pad = (n: number, len = 2) => n.toString().padStart(len, '0');
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}${sep}${pad(msFixed, 3)}`;
}
