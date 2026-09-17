/**
 * Screen Header Component
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@constants/colors';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  leftIcon?: string;
  onLeftPress?: () => void;
  rightIcon?: string;
  onRightPress?: () => void;
  style?: ViewStyle;
  showTopDivider?: boolean;
}

export function ScreenHeader({
  title,
  subtitle,
  leftIcon,
  onLeftPress,
  rightIcon,
  onRightPress,
  style,
  showTopDivider = false,
}: ScreenHeaderProps) {
  return (
    <View style={[styles.header, showTopDivider && styles.headerWithDivider, style]}>
      <View style={styles.headerTop}>
        {leftIcon && (
          <TouchableOpacity onPress={onLeftPress} style={styles.headerIcon}>
            <Text style={styles.headerIconText}>{leftIcon}</Text>
          </TouchableOpacity>
        )}
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>{title}</Text>
          {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
        </View>
        {rightIcon && (
          <TouchableOpacity onPress={onRightPress} style={styles.headerIcon}>
            <Text style={styles.headerIconText}>{rightIcon}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description && (
        <Text style={styles.emptyDescription}>{description}</Text>
      )}
      {actionLabel && onAction && (
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={onAction}
          activeOpacity={0.7}
        >
          <Text style={styles.emptyButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  isEmergency?: boolean;
}

export function Card({ children, onPress, style, isEmergency = false }: CardProps) {
  if (onPress) {
    return (
      <TouchableOpacity
        style={[
          styles.card,
          isEmergency && styles.emergencyCard,
          style,
        ]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[
        styles.card,
        isEmergency && styles.emergencyCard,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.white,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    ...Shadows.sm,
  },
  headerWithDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIcon: {
    padding: Spacing.sm,
    marginHorizontal: -Spacing.sm,
  },
  headerIconText: {
    fontSize: 24,
  },
  headerTitles: {
    flex: 1,
    marginHorizontal: Spacing.md,
  },
  headerTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  emptyDescription: {
    fontSize: Typography.sizes.base,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  emptyButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  emptyButtonText: {
    color: Colors.white,
    fontSize: Typography.sizes.base,
    fontWeight: '600',
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginVertical: Spacing.md,
    ...Shadows.md,
  },
  emergencyCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.emergency,
  },
});
