import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import type { ThemePalette } from '../hooks/useTheme';

function lightColor(color: string): { luminance: number; chroma: number } | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (!match) return null;
  const value = match[1];
  const channels = value.length === 3
    ? value.split('').map((channel) => parseInt(channel + channel, 16))
    : [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  const [red, green, blue] = channels.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return {
    luminance: 0.2126 * red + 0.7152 * green + 0.0722 * blue,
    chroma: Math.max(...channels) - Math.min(...channels),
  };
}

export function adaptThemeSurfaceStyle(style: StyleProp<ViewStyle>, palette: ThemePalette): StyleProp<ViewStyle> {
  const flattened = StyleSheet.flatten(style);
  if (!flattened) return style;

  let backgroundColor = flattened.backgroundColor;
  if (typeof backgroundColor === 'string') {
    const color = lightColor(backgroundColor);
    if (color && color.luminance > 0.92 && color.chroma < 45) {
      backgroundColor = palette.surface;
    } else if (color && color.luminance > 0.72 && color.chroma < 95) {
      backgroundColor = palette.surfaceMuted;
    }
  }

  const updatedStyle: ViewStyle = { ...flattened, backgroundColor };
  let changed = backgroundColor !== flattened.backgroundColor;
  const borderColorKeys = [
    'borderColor',
    'borderTopColor',
    'borderRightColor',
    'borderBottomColor',
    'borderLeftColor',
    'borderStartColor',
    'borderEndColor',
  ] as const;
  for (const key of borderColorKeys) {
    const border = updatedStyle[key];
    if (typeof border === 'string' && (lightColor(border)?.luminance ?? 0) > 0.48) {
      updatedStyle[key] = palette.border;
      changed = true;
    }
  }
  return changed ? updatedStyle : style;
}
