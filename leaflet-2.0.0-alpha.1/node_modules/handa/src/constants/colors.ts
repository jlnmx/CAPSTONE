/**
 * HANDA Color Palette
 * Professional emergency-response application design
 */

import { Platform, PlatformColor } from 'react-native';

export function getReadableColor(color: string, theme: 'light' | 'dark'): string {
  if (theme !== 'dark' || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) return color;

  const hex = color.slice(1);
  const channels = hex.length === 3
    ? hex.split('').map((channel) => parseInt(channel + channel, 16))
    : [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));

  if (channels.every((channel) => channel === 0) || channels.every((channel) => channel === 255)) return color;

  const lightened = channels.map((channel) => Math.round(channel + (255 - channel) * 0.45));
  return `#${lightened.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function nativeColor(name: string, fallback: string) {
  return Platform.OS !== 'web' && typeof PlatformColor === 'function' ? PlatformColor(name) : fallback;
}

const platformSurface = Platform.select({
  ios: nativeColor('systemBackground', '#FFFFFF'),
  android: nativeColor('?android:attr/colorBackground', '#FFFFFF'),
  web: 'var(--handa-surface, #FFFFFF)',
  default: '#FFFFFF',
});
const platformText = Platform.select({
  ios: nativeColor('label', '#17212B'),
  android: nativeColor('?android:attr/textColorPrimary', '#17212B'),
  web: 'var(--handa-text, #17212B)',
  default: '#17212B',
});
const platformTextMuted = Platform.select({
  ios: nativeColor('secondaryLabel', '#667085'),
  android: nativeColor('?android:attr/textColorSecondary', '#667085'),
  web: 'var(--handa-text-muted, #667085)',
  default: '#667085',
});
const platformBorder = Platform.select({
  ios: nativeColor('separator', '#D7E2EA'),
  android: nativeColor('?android:attr/colorControlHighlight', '#D7E2EA'),
  web: 'var(--handa-border, #D7E2EA)',
  default: '#D7E2EA',
});

export const Colors = {
  // Primary Colors
  primary: '#0B3A63', // Dark Navy Blue
  secondary: '#1769AA', // Secondary Blue
  
  // Emergency Colors
  emergency: '#D62828', // Emergency Red
  success: '#2E8B57', // Green for online/success
  warning: '#F4A261', // Amber/Orange for warnings
  
  // Backgrounds
  background: platformSurface, // Device-aware app background
  surface: platformSurface,
  surfaceMuted: Platform.select({ ios: nativeColor('secondarySystemBackground', '#F0F2F5'), android: nativeColor('?android:attr/colorBackground', '#F0F2F5'), web: 'var(--handa-surface-muted, #F0F2F5)', default: '#F0F2F5' }),
  white: '#FFFFFF', // High-contrast text and light surfaces
  
  // Text Colors
  text: platformText, // Device-aware readable text
  textMuted: platformTextMuted, // Device-aware muted text
  border: platformBorder,
  
  // Functional
  offline: '#E63946', // Red for offline status
  online: '#2E8B57', // Green for online status
  pending: '#F4A261', // Amber for pending sync
  synced: '#2E8B57', // Green for synced
  
  // Transparent overlays
  overlay: 'rgba(0, 0, 0, 0.5)',
  shadowColor: 'rgba(0, 0, 0, 0.1)',
};

export const Typography = {
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  weights: {
    thin: '100' as const,
    extralight: '200' as const,
    light: '300' as const,
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
    black: '900' as const,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 2,
  },
  md: {
    shadowColor: 'rgba(0, 0, 0, 0.15)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  lg: {
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
};
