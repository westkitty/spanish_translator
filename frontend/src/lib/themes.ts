export type ThemeId = 'azure' | 'darker' | 'cream';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  description: string;
  swatches: string[];
}

export const THEME_STORAGE_KEY = 'dexterpreter-theme';

export const themes: ThemeOption[] = [
  {
    id: 'azure',
    name: 'Azure Glass',
    description: 'The default blue-glow transcription room.',
    swatches: ['#050912', '#0ea5e9', '#38bdf8', '#e8eefc'],
  },
  {
    id: 'darker',
    name: 'Darker',
    description: 'Deeper black-blue with lower glow and stronger contrast.',
    swatches: ['#010205', '#111827', '#60a5fa', '#f8fafc'],
  },
  {
    id: 'cream',
    name: 'Corporate Cream',
    description: 'Warm document workspace for bright rooms and review work.',
    swatches: ['#f6efe1', '#1f2937', '#2563eb', '#92400e'],
  },
];

const themeIds = new Set<ThemeId>(themes.map((theme) => theme.id));

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && themeIds.has(value as ThemeId);
}

export function getStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return 'azure';
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(stored) ? stored : 'azure';
  } catch {
    return 'azure';
  }
}

export function applyTheme(theme: ThemeId): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

export function storeTheme(theme: ThemeId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage can be unavailable in privacy-restricted WebViews. Theme still applies for this session.
  }
}

export function setTheme(theme: ThemeId): void {
  applyTheme(theme);
  storeTheme(theme);
}

export function applyStoredTheme(): ThemeId {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
}
