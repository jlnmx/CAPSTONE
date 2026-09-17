/**
 * Status and Badge Components
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '@constants/colors';

export interface StatusBadgeProps {
  status: 'online' | 'offline' | 'synced' | 'pending' | 'error';
  style?: ViewStyle;
}

export function StatusBadge({ status, style }: StatusBadgeProps) {
  const statusConfig = {
    online: { color: Colors.online, label: '🟢 Online', icon: '🟢' },
    offline: { color: Colors.offline, label: '🔴 Offline', icon: '🔴' },
    synced: { color: Colors.success, label: 'Synced', icon: '✓' },
    pending: { color: Colors.warning, label: 'Pending', icon: '⏳' },
    error: { color: Colors.emergency, label: 'Error', icon: '✕' },
  };

  const config = statusConfig[status];

  return (
    <View style={[styles.badge, { backgroundColor: config.color }, style]}>
      <Text style={styles.badgeText}>{config.label}</Text>
    </View>
  );
}

interface ConnectivityStatusProps {
  isOnline: boolean;
}

export function ConnectivityStatus({ isOnline }: ConnectivityStatusProps) {
  return (
    <View style={styles.connectivityContainer}>
      <View
        style={[
          styles.statusDot,
          { backgroundColor: isOnline ? Colors.online : Colors.offline },
        ]}
      />
      <Text style={styles.statusText}>
        {isOnline ? 'ONLINE' : 'OFFLINE'}
      </Text>
    </View>
  );
}

interface StatCardProps {
  icon: string;
  title: string;
  value: number | string;
  subtitle?: string;
  style?: ViewStyle;
  isWarning?: boolean;
}

export function StatCard({
  icon,
  title,
  value,
  subtitle,
  style,
  isWarning = false,
}: StatCardProps) {
  return (
    <View
      style={[
        styles.statCard,
        isWarning && styles.statCardWarning,
        style,
      ]}
    >
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );
}

interface ActivityItemProps {
  icon: string;
  description: string;
  timestamp: Date;
  status: 'synced' | 'pending' | 'error';
}

export function ActivityItem({
  icon,
  description,
  timestamp,
  status,
}: ActivityItemProps) {
  const statusColors = {
    synced: Colors.success,
    pending: Colors.warning,
    error: Colors.emergency,
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <View style={styles.activityItem}>
      <Text style={styles.activityIcon}>{icon}</Text>
      <View style={styles.activityContent}>
        <Text style={styles.activityDescription}>{description}</Text>
        <Text style={styles.activityTime}>{formatTime(timestamp)}</Text>
      </View>
      <View
        style={[
          styles.activityStatus,
          { borderColor: statusColors[status] },
        ]}
      >
        <Text style={[styles.activityStatusText, { color: statusColors[status] }]}>
          {status.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: Colors.white,
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
  },
  connectivityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.full,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  statusText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
    color: Colors.text,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    marginHorizontal: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  statCardWarning: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: Spacing.sm,
  },
  statValue: {
    fontSize: Typography.sizes['3xl'],
    fontWeight: '700',
    color: Colors.text,
  },
  statTitle: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  statSubtitle: {
    fontSize: Typography.sizes.xs,
    color: Colors.warning,
    marginTop: Spacing.xs,
    fontWeight: '600',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  activityIcon: {
    fontSize: 20,
    marginRight: Spacing.md,
  },
  activityContent: {
    flex: 1,
  },
  activityDescription: {
    fontSize: Typography.sizes.sm,
    color: Colors.text,
    fontWeight: '500',
  },
  activityTime: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  activityStatus: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  activityStatusText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
  },
});
