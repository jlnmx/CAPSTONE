import React, { forwardRef } from 'react';
import { StyleSheet, Text as NativeText, TextProps, TextStyle } from 'react-native';
import { getReadableColor } from '@constants/colors';
import { useTheme } from '@hooks/useTheme';

type ThemedTextProps = TextProps & {
  darkText?: boolean;
};

export const ThemedText = forwardRef<NativeText, ThemedTextProps>(
  ({ darkText = false, style, ...props }, ref) => {
    const { resolvedTheme } = useTheme();
    const flattenedStyle = StyleSheet.flatten(style) as TextStyle | undefined;
    const color = flattenedStyle?.color;
    const foregroundStyle = !darkText && typeof color === 'string'
      ? { color: getReadableColor(color, resolvedTheme) }
      : undefined;

    return <NativeText {...props} ref={ref} style={foregroundStyle ? [style, foregroundStyle] : style} />;
  },
);

ThemedText.displayName = 'ThemedText';
