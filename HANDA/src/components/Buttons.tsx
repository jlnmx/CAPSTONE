/**
 * Button Components
 */

import React, { useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, PressableProps, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@constants/colors';
import { useResponsiveLayout } from '@hooks/useResponsiveLayout';
import { useTheme } from '@hooks/useTheme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

interface PrimaryButtonProps extends ButtonProps {}

interface AnimatedPressableProps extends PressableProps {
  activeOpacity?: number;
}

const SpringPressable = Animated.createAnimatedComponent(Pressable);

export function AnimatedPressable({
  children,
  style,
  disabled = false,
  activeOpacity = 0.85,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  ...props
}: AnimatedPressableProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const springTo = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: toValue === 1 ? 8 : 0 }).start();

  const handleHoverIn: NonNullable<PressableProps['onHoverIn']> = (event) => {
    if (!disabled) setIsHovered(true);
    onHoverIn?.(event);
  };

  const handleHoverOut: NonNullable<PressableProps['onHoverOut']> = (event) => {
    setIsHovered(false);
    onHoverOut?.(event);
  };

  const handlePressIn: NonNullable<PressableProps['onPressIn']> = (event) => {
    if (!disabled) {
      setIsPressed(true);
      springTo(0.96);
    }
    onPressIn?.(event);
  };

  const handlePressOut: NonNullable<PressableProps['onPressOut']> = (event) => {
    setIsPressed(false);
    springTo(1);
    onPressOut?.(event);
  };

  const baseStyle = typeof style === 'function' ? style({ pressed: isPressed }) : style;
  const transform = StyleSheet.flatten(baseStyle)?.transform ?? [];

  return (
    <SpringPressable
      {...props}
      disabled={disabled}
      style={[
        baseStyle,
        isHovered && !disabled && { opacity: Math.max(activeOpacity, 0.92) },
        isPressed && !disabled && styles.pressed,
        { transform: [...(Array.isArray(transform) ? transform : []), { scale }] },
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
    >
      {children}
    </SpringPressable>
  );
}
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  style,
  textStyle,
}: PrimaryButtonProps) {
  const { buttonHeight, scale } = useResponsiveLayout();

  return (
    <AnimatedPressable
      style={[
        styles.primaryButton,
        { backgroundColor: Colors.primary },
        { minHeight: buttonHeight, paddingVertical: Spacing.md * scale },
        disabled && styles.primaryButtonDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={Colors.white} size="small" />
      ) : (
        <Text style={[styles.primaryButtonText, { color: '#FFFFFF', fontSize: Typography.sizes.base * scale }, textStyle]}>{label}</Text>
      )}
    </AnimatedPressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  style,
  textStyle,
}: ButtonProps) {
  const { buttonHeight, scale } = useResponsiveLayout();
  const { palette } = useTheme();

  return (
    <AnimatedPressable
      style={[
        styles.secondaryButton,
        { backgroundColor: palette.surface, borderColor: Colors.primary },
        { minHeight: buttonHeight, paddingVertical: Spacing.md * scale },
        disabled && styles.secondaryButtonDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={Colors.primary} size="small" />
      ) : (
        <Text style={[styles.secondaryButtonText, { color: palette.text, fontSize: Typography.sizes.base * scale }, textStyle]}>{label}</Text>
      )}
    </AnimatedPressable>
  );
}

interface LinkButtonProps {
  label: string;
  onPress: () => void;
  style?: ViewStyle;
}

export function LinkButton({ label, onPress, style }: LinkButtonProps) {
  const { palette } = useTheme();
  return (
    <AnimatedPressable onPress={onPress} style={style}>
      <Text style={[styles.linkButtonText, { color: palette.text }]}>{label}</Text>
    </AnimatedPressable>
  );
}

interface IconButtonProps {
  icon: string;
  onPress: () => void;
  label?: string;
  description?: string;
  style?: ViewStyle;
}

export function IconButton({
  icon,
  onPress,
  label,
  description,
  style,
}: IconButtonProps) {
  const { buttonHeight, scale } = useResponsiveLayout();
  const { palette } = useTheme();

  return (
    <AnimatedPressable style={[styles.iconButton, { minHeight: buttonHeight, backgroundColor: palette.surface, borderColor: palette.border }, style]} onPress={onPress}>
      <Text style={[styles.iconButtonIcon, { color: palette.text, fontSize: 32 * scale }]}>{icon}</Text>
      {label && <Text style={[styles.iconButtonLabel, { color: palette.text }]}>{label}</Text>}
      {description && <Text style={[styles.iconButtonDescription, { color: palette.textMuted }]}>{description}</Text>}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.92 },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    ...Shadows.md,
  },
  primaryButtonDisabled: {
    backgroundColor: Colors.textMuted,
    opacity: 0.6,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: Typography.sizes.base,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    minHeight: 48,
    ...Shadows.sm,
  },
  secondaryButtonDisabled: {
    backgroundColor: Colors.background,
    borderColor: Colors.textMuted,
    opacity: 0.6,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: Typography.sizes.base,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  linkButtonText: {
    color: Colors.primary,
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  iconButton: {
    flex: 1,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.sm,
    ...Shadows.sm,
  },
  iconButtonIcon: {
    fontSize: 32,
    marginBottom: Spacing.sm,
  },
  iconButtonLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  iconButtonDescription: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
});
