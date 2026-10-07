/**
 * Button Components
 */

import React, { useState } from 'react';
import {
  Pressable,
  PressableProps,
  Text,
  StyleSheet,
  TextStyle,
  ViewStyle,
  ActivityIndicator,
} from 'react-native';
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

  const handleHoverIn: NonNullable<PressableProps['onHoverIn']> = (event) => {
    if (!disabled) setIsHovered(true);
    onHoverIn?.(event);
  };

  const handleHoverOut: NonNullable<PressableProps['onHoverOut']> = (event) => {
    setIsHovered(false);
    onHoverOut?.(event);
  };

  return (
    <Pressable
      {...props}
      disabled={disabled}
      style={(state) => {
        const baseStyle = typeof style === 'function' ? style(state) : style;
        return [baseStyle, isHovered && !disabled && { opacity: Math.max(activeOpacity, 0.9) }];
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
    >
      {children}
    </Pressable>
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
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
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
    letterSpacing: 0.5,
  },
  secondaryButton: {
    backgroundColor: Colors.white,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
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
    fontWeight: '600',
    letterSpacing: 0.5,
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
    backgroundColor: Colors.white,
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
