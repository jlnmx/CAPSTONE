/**
 * Responder Dashboard / Home Screen
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, SafeAreaView, Animated } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Moon, Sun, Sunrise, Sunset } from 'lucide-react-native';
import { router } from 'expo-router';
import { Colors, getReadableColor } from '@constants/colors';
import { useTheme } from '@hooks/useTheme';
import { AnimatedPressable } from '@components/Buttons';
import { ActiveDisasterCard } from '@components/ActiveDisasterCard';
import { NotificationBell } from '@components/NotificationBell';
import AppBackArrow from '@components/AppBackArrow';
import ResponderWeatherCard from '@components/ResponderWeatherCard';
import { getResponderData, getResponseHistory, ResponderDataSnapshot } from '@services/responderData';
import { getFirstName, getGreeting, getTimeOfDayPresentation } from '@utils/weatherTime';
import { useAuth } from '@hooks/useAuth';

const formattedDate = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
}).format(new Date());

export default function ResponderDashboard() {
  const { resolvedTheme } = useTheme();
  const { user } = useAuth();
  const [data, setData] = useState<ResponderDataSnapshot>({ incidents: [], evacuees: [], registeredEvacuees: 0, disasters: [], centers: [], unavailableSources: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [dataUnavailable, setDataUnavailable] = useState(false);
  const [responseCount, setResponseCount] = useState<number | null>(null);

  const loadData = async () => {
    getResponseHistory().then((history) => setResponseCount(history.length)).catch(() => undefined);
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

  const activeDisaster = data.disasters.find((disaster) => disaster.status.toLowerCase() === 'active')
    ?? data.disasters.find((disaster) => disaster.status.toLowerCase() === 'upcoming');
  const disasterIsActive = activeDisaster?.status.toLowerCase() === 'active';
  const activeIncidents = data.incidents.filter((incident) => ['reported', 'acknowledged', 'in_progress'].includes(incident.status)).length;
  const displayedEvacuees = data.unavailableSources.includes('evacuees') || data.unavailableSources.includes('registrations') ? 'N/A' : data.evacuees.length + data.registeredEvacuees;
  const displayedIncidents = data.unavailableSources.includes('incidents') ? 'N/A' : activeIncidents;
  const displayedCenters = data.unavailableSources.includes('centers') ? 'N/A' : data.centers.length;
  const displayedResponses = responseCount ?? 'N/A';
  const timePresentation = getTimeOfDayPresentation();
  const GreetingIcon = timePresentation.label === 'Dawn'
    ? Sunrise
    : timePresentation.label === 'Dusk'
      ? Sunset
      : timePresentation.label === 'Night'
        ? Moon
        : Sun;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <AppBackArrow />
          <Text style={styles.headerLogo}>HANDA</Text>
          <NotificationBell />
        </View>

        <View style={styles.greeting}>
          <View>
            <Text style={styles.greetingTitle}>{getGreeting()}, {getFirstName(user, 'Responder')}!</Text>
            <Text style={styles.greetingDate}>{formattedDate}</Text>
          </View>
          <View style={[styles.weatherIcon, { backgroundColor: timePresentation.indicator, borderColor: timePresentation.accent }]} accessibilityLabel={`${timePresentation.label} weather`}>
            <GreetingIcon size={23} color={timePresentation.background} strokeWidth={2.5} />
          </View>
        </View>

        <ResponderWeatherCard disasterActive={disasterIsActive} />

        {disasterIsActive && activeDisaster && (
          <ActiveDisasterCard
            active
            title={activeDisaster.name}
            description={`${activeDisaster.status.toUpperCase()} · ${activeDisaster.severity.toUpperCase()} · ${activeDisaster.affectedAreas} affected areas${activeDisaster.description ? ` · ${activeDisaster.description}` : ''}`}
            onPress={() => router.push('/map')}
            accessibilityLabel="Open map to review disaster and incident activity"
          />
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        </View>

        <View style={styles.statsContainer}>
          <StatTile tone="forest" icon="account-group-outline" mark="account-group-outline" value={isLoading ? '...' : displayedEvacuees} label="Total Evacuees" onPress={() => router.push('/evacuees')} />
          <StatTile tone="clay" icon="alert-outline" mark="alert-octagon-outline" value={isLoading ? '...' : displayedIncidents} label="Active Incidents" onPress={() => router.push('/incidents')} />
        </View>

        <View style={styles.statsContainer}>
          <StatTile tone="teal" icon="home-city-outline" mark="home-city-outline" value={isLoading ? '...' : displayedCenters} label="Evacuation Centers" onPress={() => router.push('/responder-center-status')} />
          <StatTile tone="sand" icon="history" mark="clipboard-text-clock-outline" value={isLoading ? '...' : displayedResponses} label="Response History" onPress={() => router.push('/response-history')} />
        </View>

        <Text style={styles.dataSource}>{isLoading ? 'Loading live server data...' : dataUnavailable ? `Partial live data · unavailable: ${data.unavailableSources.join(', ')}` : 'Live server data · refreshes every 15 seconds'}</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const TILE_TONES = {
  forest: { bg: '#1F6B2B', fg: '#FFFFFF', badgeBg: '#F4F8D8', badgeFg: '#1F6B2B', mark: 'rgba(255,255,255,0.14)' },
  clay: { bg: '#C9573F', fg: '#FFFFFF', badgeBg: '#FFF1E8', badgeFg: '#C9573F', mark: 'rgba(255,255,255,0.16)' },
  teal: { bg: '#1E4D5C', fg: '#FFFFFF', badgeBg: '#E6F0F3', badgeFg: '#1E4D5C', mark: 'rgba(255,255,255,0.14)' },
  sand: { bg: '#ECE6D6', fg: '#1B3D20', badgeBg: '#1F6B2B', badgeFg: '#FFFFFF', mark: 'rgba(31,107,43,0.12)' },
};

interface StatTileProps {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  mark: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  value: number | string;
  label: string;
  tone: keyof typeof TILE_TONES;
  onPress: () => void;
}

function StatTile({ icon, mark, value, label, tone, onPress }: StatTileProps) {
  const t = TILE_TONES[tone];
  const lift = React.useRef(new Animated.Value(0)).current;
  const to = (v: number) => Animated.spring(lift, { toValue: v, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  const transform = [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }, { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }];
  return (
    <AnimatedPressable style={[styles.statTile, { backgroundColor: t.bg, transform }]} onPress={onPress} onHoverIn={() => to(1)} onHoverOut={() => to(0)} accessibilityRole="button" accessibilityLabel={`${label}: ${value}. Open related records`}>
      <MaterialCommunityIcons name={mark} size={96} color={t.mark} style={styles.statMark} />
      <View style={[styles.statBadge, { backgroundColor: t.badgeBg }]}><MaterialCommunityIcons name={icon} size={21} color={t.badgeFg} /></View>
      <View style={styles.statFooter}>
        <View style={styles.statCopy}>
          <Text style={[styles.statValue, { color: t.fg }]}>{value}</Text>
          <Text style={[styles.statLabel, { color: t.fg }]} numberOfLines={1}>{label}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={18} color={t.fg} />
      </View>
    </AnimatedPressable>
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
    color: '#218B25',
    fontSize: 15,
    fontWeight: '800',
  },
  greetingDate: {
    color: '#218B25',
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
    backgroundColor: Colors.surface,
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
    gap: 12,
    marginBottom: 12,
  },
  dataSource: { marginHorizontal: 18, marginTop: -3, marginBottom: 12, color: Colors.textMuted, fontSize: 10 },
  statTile: {
    flex: 1,
    minHeight: 112,
    borderRadius: 22,
    padding: 14,
    overflow: 'hidden',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  statMark: { position: 'absolute', right: -14, bottom: -14 },
  statBadge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  statFooter: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 10 },
  statCopy: { flex: 1 },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  pendingTile: {
    height: 51,
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 9,
    backgroundColor: Colors.surfaceMuted,
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
