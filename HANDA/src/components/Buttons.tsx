/**
 * Button Components
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@constants/colors';

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

interface PrimaryButtonProps extends ButtonProps {}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  style,
  textStyle,
}: PrimaryButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.primaryButton,
        disabled && styles.primaryButtonDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={Colors.white} size="small" />
      ) : (
        <Text style={[styles.primaryButtonText, textStyle]}>{label}</Text>
      )}
    </TouchableOpacity>
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
  return (
    <TouchableOpacity
      style={[
        styles.secondaryButton,
        disabled && styles.secondaryButtonDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={Colors.primary} size="small" />
      ) : (
        <Text style={[styles.secondaryButtonText, textStyle]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

interface LinkButtonProps {
  label: string;
  onPress: () => void;
  style?: ViewStyle;
}

export function LinkButton({ label, onPress, style }: LinkButtonProps) {
  return (
    <TouchableOpacity onPress={onPress} style={style} activeOpacity={0.7}>
      <Text style={styles.linkButtonText}>{label}</Text>
    </TouchableOpacity>
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
  return (
    <TouchableOpacity
      style={[styles.iconButton, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.iconButtonIcon}>{icon}</Text>
      {label && <Text style={styles.iconButtonLabel}>{label}</Text>}
      {description && <Text style={styles.iconButtonDescription}>{description}</Text>}
    </TouchableOpacity>
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
