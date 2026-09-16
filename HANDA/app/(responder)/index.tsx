/**
 * Responder Dashboard / Home Screen
 */

import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  Alert,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@constants/colors';
import { AnimatedPressable } from '@components/Buttons';
import {
  MOCK_DASHBOARD_STATS,
} from '@data/mockData';

export default function ResponderDashboard() {
  const showComingSoon = (label: string) =>
    Alert.alert('Coming Soon', `${label} module coming soon.`);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerLogo}>HANDA</Text>
          <AnimatedPressable
            onPress={() => Alert.alert('Notifications', 'No new notifications.')}
            style={styles.notificationButton}
          >
            <MaterialCommunityIcons name="bell-outline" size={29} color={Colors.white} />
            <View style={styles.notificationDot} />
          </AnimatedPressable>
        </View>

        <View style={styles.disasterCard}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={39}
            color={Colors.white}
          />
          <View style={styles.disasterCopy}>
            <Text style={styles.disasterName}>Flood Response</Text>
            <Text style={styles.disasterDescription}>Active Disaster</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={31} color={Colors.white} />
        </View>

        <View style={styles.statsContainer}>
          <StatTile icon="account-group-outline" value={MOCK_DASHBOARD_STATS.totalEvacuees} label="Total Evacuees" color="#218B25" />
          <StatTile icon="alert-outline" value={MOCK_DASHBOARD_STATS.activeIncidents} label="Active Incidents" color="#D63F43" />
        </View>

        <View style={styles.statsContainer}>
          <StatTile icon="home-city-outline" value={MOCK_DASHBOARD_STATS.evacuationCenters} label="Evacuation Centers" color="#1E5987" />
          <StatTile icon="account-outline" value="58" label="Available Capacity" color="#C9431B" />
        </View>

        <View style={styles.pendingTile}>
          <MaterialCommunityIcons name="plus-circle-outline" size={31} color="#D92BC4" />
          <Text style={styles.pendingValue}>{MOCK_DASHBOARD_STATS.pendingSync}</Text>
          <Text style={styles.pendingLabel}>Pending Sync Records</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>QUICK ACTION</Text>
          <View style={styles.quickActionsGrid}>
            <ActionButton icon="account-plus-outline" label="Register Evacuee" onPress={() => router.push('/evacuees')} />
            <ActionButton icon="checkbox-marked-outline" label="Verify Check-in" onPress={() => showComingSoon('Verify Check-in')} />
          </View>
          <View style={styles.quickActionsGrid}>
            <ActionButton icon="alert-circle-outline" label="Report Incident" onPress={() => router.push('/incidents')} />
            <ActionButton icon="home-city-outline" label="Center status" onPress={() => showComingSoon('Center status')} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface StatTileProps {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  value: number | string;
  label: string;
  color: string;
}

function StatTile({ icon, value, label, color }: StatTileProps) {
  return (
    <View style={styles.statTile}>
      <MaterialCommunityIcons name={icon} size={31} color={color} style={styles.statIcon} />
      <View>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        <Text style={[styles.statLabel, { color }]}>{label}</Text>
      </View>
    </View>
  );
}

interface ActionButtonProps {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
}

function ActionButton({ icon, label, onPress }: ActionButtonProps) {
  return (
    <AnimatedPressable style={styles.actionButton} onPress={onPress}>
      <MaterialCommunityIcons name={icon} size={25} color="#218B25" style={styles.actionIcon} />
      <Text style={styles.actionLabel}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 86,
    paddingHorizontal: 16,
    backgroundColor: '#218B25',
  },
  headerLogo: {
    color: Colors.white,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 1,
  },
  notificationButton: {
    width: 34,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 5,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.white,
  },
  disasterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 18,
    marginTop: 12,
    marginBottom: 12,
    paddingHorizontal: 14,
    height: 102,
    borderRadius: 9,
    backgroundColor: '#D63F43',
  },
  disasterName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  disasterCopy: {
    flex: 1,
    marginLeft: 10,
  },
  disasterDescription: {
    fontSize: 12,
    color: Colors.white,
  },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 18,
    gap: 8,
    marginBottom: 10,
  },
  statTile: {
    flex: 1,
    height: 100,
    borderRadius: 9,
    backgroundColor: '#EEF2EF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  statIcon: {
    marginRight: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 3,
  },
  statLabel: {
    fontSize: 9,
  },
  pendingTile: {
    height: 51,
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 9,
    backgroundColor: '#EEF2EF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  pendingIcon: {
    marginRight: 8,
  },
  pendingValue: {
    color: '#D92BC4',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 3,
  },
  pendingLabel: {
    color: '#D92BC4',
    fontSize: 9,
    marginLeft: 6,
  },
  section: {
    marginHorizontal: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#218B25',
    marginBottom: 7,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  actionButton: {
    width: '48%',
    height: 46,
    borderRadius: 8,
    backgroundColor: '#EEF2EF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
  },
  actionIcon: {
    marginRight: 6,
  },
  actionLabel: {
    color: '#218B25',
    fontSize: 9,
  },
});
