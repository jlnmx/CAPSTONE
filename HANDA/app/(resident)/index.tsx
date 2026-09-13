/**
 * Resident Dashboard / Home Screen
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  Alert,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '@hooks/useAuth';
import { Colors, Typography, Spacing } from '@constants/colors';
import { ConnectivityStatus } from '@components/StatusBadge';
import { Card } from '@components/ScreenHeader';
import { HandaLogo } from '@components/HandaLogo';
import { MOCK_ACTIVE_DISASTERS, MOCK_EVACUATION_CENTERS } from '@data/mockData';

export default function ResidentDashboard() {
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

        {/* Welcome Message */}
        <Card>
          <Text style={styles.welcomeTitle}>Welcome, {user?.name}!</Text>
          <Text style={styles.welcomeSubtitle}>
            You are logged in as a Community Resident. Stay informed about evacuation
            procedures and emergency alerts.
          </Text>
        </Card>

        {/* Active Disaster */}
        {MOCK_ACTIVE_DISASTERS.length > 0 && (
          <Card isEmergency={true} style={styles.disasterCard}>
            <View style={styles.disasterHeader}>
              <View>
                <Text style={styles.disasterLabel}>ACTIVE ALERT</Text>
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
            <Text style={styles.actionText}>
              Please follow emergency procedures and stay tuned to official channels for updates.
            </Text>
          </Card>
        )}

        {/* Evacuation Centers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nearby Evacuation Centers</Text>
          {MOCK_EVACUATION_CENTERS.map((center) => (
            <Card key={center.id}>
              <Text style={styles.centerName}>{center.name}</Text>
              <Text style={styles.centerLocation}>📍 {center.location}</Text>
              <View style={styles.centerStats}>
                <Text style={styles.centerStat}>
                  Capacity: {center.currentOccupancy}/{center.capacity}
                </Text>
                <View
                  style={[
                    styles.capacityBar,
                    {
                      width:
                        `${Math.min((center.currentOccupancy / center.capacity) * 100, 100)}%` as any,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.centerStatus,
                  {
                    color:
                      center.status === 'full' ? Colors.emergency : Colors.success,
                  },
                ]}
              >
                Status: {center.status.charAt(0).toUpperCase() + center.status.slice(1)}
              </Text>
            </Card>
          ))}
        </View>

        {/* Info Section */}
        <Card>
          <Text style={styles.infoTitle}>Important Information</Text>
          <Text style={styles.infoText}>
            • Keep your phone charged and make sure you have this app installed
          </Text>
          <Text style={styles.infoText}>
            • Follow instructions from local authorities
          </Text>
          <Text style={styles.infoText}>
            • Have an evacuation plan ready for your family
          </Text>
          <Text style={styles.infoText}>
            • Know your nearest evacuation center
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  welcomeTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: Colors.primary,
  },
  welcomeSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
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
  actionText: {
    fontSize: Typography.sizes.sm,
    color: Colors.emergency,
    marginTop: Spacing.md,
    fontWeight: '600',
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
  centerName: {
    fontSize: Typography.sizes.base,
    fontWeight: '700',
    color: Colors.text,
  },
  centerLocation: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
  centerStats: {
    marginTop: Spacing.md,
  },
  centerStat: {
    fontSize: Typography.sizes.sm,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  capacityBar: {
    height: 6,
    backgroundColor: Colors.success,
    borderRadius: 3,
  },
  centerStatus: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    marginTop: Spacing.md,
  },
  infoTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  infoText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
});
