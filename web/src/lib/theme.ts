import { useSyncExternalStore } from 'react';

/** Light/dark theme: a class on <html>, remembered in localStorage (dark by default). */

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'btc-invest.theme';
const listeners = new Set<() => void>();

const current = (): Theme =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';

export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // storage blocked: the theme still applies to this page
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useTheme = () => useSyncExternalStore(subscribe, current);
