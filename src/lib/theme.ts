import { useSyncExternalStore } from 'react';

export type Theme = 'system' | 'light' | 'dark';
const KEY = 'salahiyati:theme';
const listeners = new Set<() => void>();

/** The app always opens in the light theme. */
export function getTheme(): Theme {
  return 'light';
}

export function applyTheme(): void {
  const theme = getTheme();
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* storage unavailable */
  }
  applyTheme();
  listeners.forEach((l) => l());
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getTheme,
  );
}
