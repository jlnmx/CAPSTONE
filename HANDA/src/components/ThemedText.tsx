import React, { forwardRef } from 'react';
import { StyleSheet, Text as NativeText, TextProps, TextStyle } from 'react-native';
import { getReadableColor } from '@constants/colors';
import { AppFontFamily, AppHeadingFontFamily } from '@constants/typography';
import { useTheme } from '@hooks/useTheme';

type ThemedTextProps = TextProps & {
  darkText?: boolean;
};

export const ThemedText = forwardRef<NativeText, ThemedTextProps>(
  ({ darkText = false, style, ...props }, ref) => {
    const { resolvedTheme } = useTheme();
    const flattenedStyle = StyleSheet.flatten(style) as TextStyle | undefined;
    const color = flattenedStyle?.color;
    const fontWeight = flattenedStyle?.fontWeight;
    const isHeadline = Number(flattenedStyle?.fontSize ?? 16) >= 22
      && (fontWeight === 'bold' || Number(fontWeight) >= 700);
    const fontFamily = flattenedStyle?.fontFamily ?? (isHeadline ? AppHeadingFontFamily : AppFontFamily);
    const foregroundStyle = !darkText && typeof color === 'string'
      ? { color: getReadableColor(color, resolvedTheme) }
      : undefined;

    return <NativeText {...props} ref={ref} style={[{ fontFamily }, style, foregroundStyle]} />;
  },
);

ThemedText.displayName = 'ThemedText';
