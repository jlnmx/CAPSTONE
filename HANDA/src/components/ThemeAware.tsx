import React from 'react';
import {
  Pressable as NativePressable,
  SafeAreaView as NativeSafeAreaView,
  ScrollView as NativeScrollView,
  Text as NativeText,
  TextInput as NativeTextInput,
  TouchableOpacity as NativeTouchableOpacity,
  StyleSheet,
  View as NativeView,
} from 'react-native';
import { getReadableColor } from '@constants/colors';
import { useTheme } from '@hooks/useTheme';
import { adaptThemeSurfaceStyle } from '@utils/themeColors';

export type ThemeAwareView = NativeView;
export type ThemeAwareSafeAreaView = NativeSafeAreaView;
export type ThemeAwareScrollView = NativeScrollView;
export type ThemeAwarePressable = React.ElementRef<typeof NativePressable>;
export type ThemeAwareTouchableOpacity = React.ElementRef<typeof NativeTouchableOpacity>;
export type ThemeAwareText = NativeText;
export type ThemeAwareTextInput = NativeTextInput;

export const ThemeAwareView = React.forwardRef<NativeView, React.ComponentProps<typeof NativeView>>((props, ref) => {
  const { resolvedTheme, palette } = useTheme();
  return <NativeView {...props} ref={ref} style={resolvedTheme === 'dark' ? adaptThemeSurfaceStyle(props.style, palette) : props.style} />;
});

export const ThemeAwareSafeAreaView = React.forwardRef<NativeSafeAreaView, React.ComponentProps<typeof NativeSafeAreaView>>((props, ref) => {
  const { resolvedTheme, palette } = useTheme();
  return <NativeSafeAreaView {...props} ref={ref} style={resolvedTheme === 'dark' ? adaptThemeSurfaceStyle(props.style, palette) : props.style} />;
});

export const ThemeAwareScrollView = React.forwardRef<NativeScrollView, React.ComponentProps<typeof NativeScrollView>>((props, ref) => {
  const { resolvedTheme, palette } = useTheme();
  return (
    <NativeScrollView
      {...props}
      ref={ref}
      style={resolvedTheme === 'dark' ? adaptThemeSurfaceStyle(props.style, palette) : props.style}
      contentContainerStyle={resolvedTheme === 'dark' ? adaptThemeSurfaceStyle(props.contentContainerStyle, palette) : props.contentContainerStyle}
    />
  );
});

export const ThemeAwarePressable = React.forwardRef<React.ElementRef<typeof NativePressable>, React.ComponentProps<typeof NativePressable>>((props, ref) => {
  const { resolvedTheme, palette } = useTheme();
  const pressableStyle = props.style;
  const style = typeof pressableStyle === 'function'
    ? (state: { pressed: boolean }) => {
      const currentStyle = pressableStyle(state);
      return resolvedTheme === 'dark' ? adaptThemeSurfaceStyle(currentStyle, palette) : currentStyle;
    }
    : resolvedTheme === 'dark'
      ? adaptThemeSurfaceStyle(pressableStyle, palette)
      : pressableStyle;
  return <NativePressable {...props} ref={ref} style={style} />;
});

export const ThemeAwareTouchableOpacity = React.forwardRef<React.ElementRef<typeof NativeTouchableOpacity>, React.ComponentProps<typeof NativeTouchableOpacity>>((props, ref) => {
  const { resolvedTheme, palette } = useTheme();
  return (
    <NativeTouchableOpacity
      {...props}
      ref={ref}
      style={resolvedTheme === 'dark' ? adaptThemeSurfaceStyle(props.style, palette) : props.style}
    />
  );
});

export const ThemeAwareText = React.forwardRef<NativeText, React.ComponentProps<typeof NativeText>>((props, ref) => {
  const { resolvedTheme, palette } = useTheme();
  const flattenedStyle = StyleSheet.flatten(props.style);
  const foregroundStyle = resolvedTheme === 'dark'
    ? {
      color: typeof flattenedStyle?.color === 'string'
        ? getReadableColor(flattenedStyle.color, resolvedTheme)
        : palette.text,
    }
    : undefined;
  return <NativeText {...props} ref={ref} style={[props.style, foregroundStyle]} />;
});

export const ThemeAwareTextInput = React.forwardRef<NativeTextInput, React.ComponentProps<typeof NativeTextInput>>((props, ref) => {
  const { resolvedTheme, palette } = useTheme();
  const flattenedStyle = StyleSheet.flatten(props.style);
  const style = resolvedTheme === 'dark'
    ? [
      adaptThemeSurfaceStyle(props.style, palette),
      { color: typeof flattenedStyle?.color === 'string' ? getReadableColor(flattenedStyle.color, resolvedTheme) : palette.text },
    ]
    : props.style;
  const placeholderTextColor = typeof props.placeholderTextColor === 'string'
    ? getReadableColor(props.placeholderTextColor, resolvedTheme)
    : props.placeholderTextColor;
  return <NativeTextInput {...props} ref={ref} placeholderTextColor={placeholderTextColor} style={style} />;
});

