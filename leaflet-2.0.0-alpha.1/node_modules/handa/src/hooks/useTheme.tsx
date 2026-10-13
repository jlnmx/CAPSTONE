import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, useColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'system' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export type ThemePalette = {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
};

const THEME_MODE_KEY = 'handa.themeMode';

function applyNativeAppearance(mode: ThemeMode) {
  if (typeof Appearance.setColorScheme === 'function') {
    Appearance.setColorScheme(mode === 'system' ? null : mode);
  }
}

const palettes: Record<ResolvedTheme, ThemePalette> = {
  light: {
    background: '#F4F7F9',
    surface: '#FFFFFF',
    surfaceMuted: '#F0F2F5',
    text: '#17212B',
    textMuted: '#667085',
    border: '#D7E2EA',
  },
  dark: {
    background: '#101820',
    surface: '#182631',
    surfaceMuted: '#223541',
    text: '#FFFFFF',
    textMuted: '#FFFFFF',
    border: '#344A58',
  },
};

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  palette: ThemePalette;
  setMode: (mode: ThemeMode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const resolvedTheme: ResolvedTheme = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  useEffect(() => {
    applyNativeAppearance(mode);
  }, [mode]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      document.getElementById('handa-dark-readable-text')?.remove();
      document.getElementById('handa-theme-rendering')?.remove();
      root.dataset.handaTheme = resolvedTheme;
      root.style.setProperty('--handa-surface', palettes[resolvedTheme].surface);
      root.style.setProperty('--handa-surface-muted', palettes[resolvedTheme].surfaceMuted);
      root.style.setProperty('--handa-text', palettes[resolvedTheme].text);
      root.style.setProperty('--handa-text-muted', palettes[resolvedTheme].textMuted);
      root.style.setProperty('--handa-border', palettes[resolvedTheme].border);
      root.style.setProperty('color-scheme', resolvedTheme);
    }
  }, [resolvedTheme]);

  useEffect(() => {
    void AsyncStorage.getItem(THEME_MODE_KEY).then((storedMode) => {
      if (storedMode === 'light' || storedMode === 'system' || storedMode === 'dark') setModeState(storedMode);
    });
  }, []);

  const setMode = async (nextMode: ThemeMode) => {
    setModeState(nextMode);
    applyNativeAppearance(nextMode);
    await AsyncStorage.setItem(THEME_MODE_KEY, nextMode);
  };

  const value = useMemo(() => ({ mode, resolvedTheme, palette: palettes[resolvedTheme], setMode }), [mode, resolvedTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
