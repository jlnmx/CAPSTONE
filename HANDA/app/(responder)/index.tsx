/**
 * Responder Dashboard / Home Screen
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  Alert,
  SafeAreaView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@constants/colors';
import { AnimatedPressable } from '@components/Buttons';
import { NotificationBell } from '@components/NotificationBell';
import ResponderWeatherCard from '@components/ResponderWeatherCard';
import { getResponderData, ResponderDataSnapshot } from '@services/responderData';
import { getTimeOfDayPresentation } from '@utils/weatherTime';

const formattedDate = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
}).format(new Date());

export default function ResponderDashboard() {
  const [data, setData] = useState<ResponderDataSnapshot>({ incidents: [], evacuees: [], disasters: [], centers: [], unavailableSources: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [dataUnavailable, setDataUnavailable] = useState(false);

  const loadData = async () => {
    try {
      const snapshot = await getResponderData();
      setData(snapshot);
      setDataUnavailable(snapshot.unavailableSources.length > 0);
    } catch {
      setDataUnavailable(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    const refresh = setInterval(() => void loadData(), 15000);
    return () => clearInterval(refresh);
  }, []);

  const activeDisaster = data.disasters.find((disaster) => disaster.status.toLowerCase() === 'active');
  const activeIncidents = data.incidents.filter((incident) => ['reported', 'acknowledged', 'in_progress'].includes(incident.status)).length;
  const displayedEvacuees = data.unavailableSources.includes('evacuees') ? 'N/A' : data.evacuees.length;
  const displayedIncidents = data.unavailableSources.includes('incidents') ? 'N/A' : activeIncidents;
  const displayedCenters = data.unavailableSources.includes('centers') ? 'N/A' : data.centers.length;
  const availableCapacity = data.centers.reduce((total, center) => {
    if (center.status === 'closed') return total;
    return total + Math.max(0, center.capacity - center.currentOccupancy);
  }, 0);
  const displayedCapacity = data.unavailableSources.includes('centers') ? 'N/A' : availableCapacity;
  const timePresentation = getTimeOfDayPresentation();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerLogo}>HANDA</Text>
          <NotificationBell />
        </View>

        <View style={styles.greeting}>
          <View>
            <Text style={styles.greetingTitle}>Welcome, Responder!</Text>
            <Text style={styles.greetingDate}>{formattedDate}</Text>
          </View>
          <View style={[styles.weatherIcon, { backgroundColor: timePresentation.indicator, borderColor: timePresentation.accent }]} accessibilityLabel={`${timePresentation.label} weather`}>
            <MaterialCommunityIcons name={timePresentation.icon} size={26} color={timePresentation.background} />
          </View>
        </View>

        <ResponderWeatherCard disasterActive={!!activeDisaster} />

        <AnimatedPressable style={[styles.disasterCard, activeDisaster && styles.disasterCardActive, !activeDisaster && styles.disasterCardEmpty]} onPress={() => activeDisaster && router.push('/map')} disabled={!activeDisaster} accessibilityRole="button" accessibilityLabel="Open map to review disaster and incident activity">
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={39}
            color={Colors.white}
          />
          <View style={styles.disasterCopy}>
            <Text style={[styles.disasterName, activeDisaster && styles.disasterNameActive]}>{activeDisaster?.name ?? 'No active disaster'}</Text>
            <Text style={[styles.disasterDescription, activeDisaster && styles.disasterDescriptionActive]}>{activeDisaster ? `${activeDisaster.severity.toUpperCase()} · Active Disaster` : 'Monitoring server records'}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={31} color={Colors.white} />
        </AnimatedPressable>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        </View>

        <View style={styles.statsContainer}>
          <StatTile icon="account-group-outline" value={isLoading ? '...' : displayedEvacuees} label="Total Evacuees" color="#218B25" onPress={() => router.push('/evacuees')} />
          <StatTile icon="alert-outline" value={isLoading ? '...' : displayedIncidents} label="Active Incidents" color="#D63F43" onPress={() => router.push('/incidents')} />
        </View>

        <View style={styles.statsContainer}>
          <StatTile icon="home-city-outline" value={isLoading ? '...' : displayedCenters} label="Evacuation Centers" color="#1E5987" onPress={() => router.push('/map')} />
          <StatTile icon="account-multiple-outline" value={isLoading ? '...' : displayedCapacity} label="Available Capacity" color="#C85B1C" onPress={() => router.push('/responder-center-status')} />
        </View>

        <Text style={styles.dataSource}>{isLoading ? 'Loading live server data...' : dataUnavailable ? `Partial live data · unavailable: ${data.unavailableSources.join(', ')}` : 'Live server data · refreshes every 15 seconds'}</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

interface StatTileProps {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  value: number | string;
  label: string;
  color: string;
  onPress: () => void;
}

function StatTile({ icon, value, label, color, onPress }: StatTileProps) {
  return (
    <AnimatedPressable style={styles.statTile} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}. Open related records`}>
      <MaterialCommunityIcons name={icon} size={31} color={color} style={styles.statIcon} />
      <View>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        <Text style={[styles.statLabel, { color }]}>{label}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={17} color={color} style={styles.statChevron} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7FAF7',
  },
  container: {
    flex: 1,
    backgroundColor: '#F7FAF7',
  },
  contentContainer: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    paddingBottom: 18,
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
  greeting: {
    minHeight: 55,
    paddingHorizontal: 18,
    paddingTop: 11,
    paddingBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greetingTitle: {
    color: '#187821',
    fontSize: 15,
    fontWeight: '800',
  },
  greetingDate: {
    color: '#187821',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 4,
  },
  weatherIcon: {
    width: 29,
    height: 29,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E3A02C',
    backgroundColor: '#FFD477',
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingHorizontal: 10,
    minHeight: 61,
    borderRadius: 8,
    backgroundColor: '#D63F43',
  },
  disasterCardActive: { minHeight: 102, marginBottom: 12, paddingHorizontal: 14, borderRadius: 9 },
  disasterCardEmpty: { backgroundColor: '#6B7B85' },
  disasterName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
  disasterNameActive: { fontSize: 18, fontWeight: '700' },
  disasterCopy: {
    flex: 1,
    marginLeft: 10,
  },
  disasterDescription: {
    fontSize: 9,
    color: Colors.white,
  },
  disasterDescriptionActive: { fontSize: 12 },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 18,
    gap: 8,
    marginBottom: 10,
  },
  dataSource: { marginHorizontal: 18, marginTop: -3, marginBottom: 12, color: Colors.textMuted, fontSize: 10 },
  statTile: {
    flex: 1,
    height: 100,
    borderRadius: 9,
    backgroundColor: '#EEF2EF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    overflow: 'hidden',
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
  statChevron: { marginLeft: 'auto' },
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
});
