/**
 * Responder Dashboard / Home Screen
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  FlatList,
  Text,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useAuth } from '@hooks/useAuth';
import { Colors, Typography, Spacing } from '@constants/colors';
import { ConnectivityStatus, StatCard, ActivityItem } from '@components/StatusBadge';
import { Card } from '@components/ScreenHeader';
import { IconButton } from '@components/Buttons';
import { HandaLogo } from '@components/HandaLogo';
import {
  MOCK_DASHBOARD_STATS,
  MOCK_RECENT_ACTIVITY,
  MOCK_ACTIVE_DISASTERS,
} from '@data/mockData';

export default function ResponderDashboard() {
  const { user, logout } = useAuth();
  const [isOnline, setIsOnline] = useState(true);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Logout',
          onPress: async () => {
            await logout();
          },
          style: 'destructive',
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <HandaLogo size="small" />
          </View>
          <ConnectivityStatus isOnline={isOnline} />
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>👋</Text>
          </TouchableOpacity>
        </View>

        {/* Active Disaster */}
        {MOCK_ACTIVE_DISASTERS.length > 0 && (
          <Card isEmergency={true} style={styles.disasterCard}>
            <View style={styles.disasterHeader}>
              <View>
                <Text style={styles.disasterLabel}>ACTIVE DISASTER</Text>
                <Text style={styles.disasterName}>
                  {MOCK_ACTIVE_DISASTERS[0].name}
                </Text>
              </View>
              <View style={styles.disasterStatus}>
                <Text style={styles.statusBadge}>{MOCK_ACTIVE_DISASTERS[0].status.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.disasterDescription}>
              {MOCK_ACTIVE_DISASTERS[0].description}
            </Text>
          </Card>
        )}

        {/* Statistics */}
        <View style={styles.statsContainer}>
          <StatCard
            icon="👨‍👩‍👧‍👦"
            title="Total Evacuees"
            value={MOCK_DASHBOARD_STATS.totalEvacuees}
          />
          <StatCard
            icon="🚨"
            title="Active Incidents"
            value={MOCK_DASHBOARD_STATS.activeIncidents}
          />
        </View>

        <View style={styles.statsContainer}>
          <StatCard
            icon="🏠"
            title="Evacuation Centers"
            value={MOCK_DASHBOARD_STATS.evacuationCenters}
          />
          <StatCard
            icon="⏳"
            title="Pending Sync"
            value={MOCK_DASHBOARD_STATS.pendingSync}
            isWarning={true}
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <IconButton
              icon="📝"
              label="Register Evacuee"
              description="Register new evacuees"
              onPress={() =>
                Alert.alert('Coming Soon', 'Register Evacuee module coming soon.')
              }
            />
            <IconButton
              icon="📢"
              label="Report Incident"
              description="Report an incident"
              onPress={() =>
                Alert.alert('Coming Soon', 'Report Incident module coming soon.')
              }
            />
          </View>
          <View style={styles.quickActionsGrid}>
            <IconButton
              icon="🗺️"
              label="View Map"
              description="View operational map"
              onPress={() => Alert.alert('Coming Soon', 'Map module coming soon.')}
            />
            <IconButton
              icon="🏢"
              label="Evacuation Centers"
              description="Manage centers"
              onPress={() =>
                Alert.alert('Coming Soon', 'Evacuation Centers module coming soon.')
              }
            />
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Card>
            <FlatList
              data={MOCK_RECENT_ACTIVITY}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <ActivityItem
                  icon={item.icon}
                  description={item.description}
                  timestamp={item.timestamp}
                  status={item.status}
                />
              )}
            />
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

import { TouchableOpacity } from 'react-native';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 12,
  },
  headerLeft: {
    flex: 1,
  },
  logoutButton: {
    padding: Spacing.md,
  },
  logoutText: {
    fontSize: 20,
  },
  disasterCard: {
    marginBottom: Spacing.xl,
  },
  disasterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  disasterLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
    color: Colors.emergency,
    marginBottom: Spacing.xs,
  },
  disasterName: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  disasterStatus: {
    backgroundColor: Colors.emergency,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 6,
  },
  statusBadge: {
    color: Colors.white,
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
  },
  disasterDescription: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    marginTop: Spacing.md,
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
});
