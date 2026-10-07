import React from 'react';
import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useWeather } from '@hooks/useWeather';
import { WeatherWidget } from '@components/WeatherWidget';
import { Colors } from '@constants/colors';
import { NotificationBell } from '@components/NotificationBell';
import { AnimatedPressable } from '@components/Buttons';
import { ActiveDisasterCard } from '@components/ActiveDisasterCard';
import { authenticatedFetch } from '@services/apiClient';
import { getGreeting, getTimeOfDayPresentation } from '@utils/weatherTime';

const actions = [
  { icon: 'account-plus-outline' as const, label: 'Register Evacuee', route: '/(resident)/register-evacuee' },
  { icon: 'checkbox-marked-outline' as const, label: 'Verify Check-in', route: '/(resident)/verify-status' },
  { icon: 'alert-circle-outline' as const, label: 'Report incident', route: '/(resident)/report' },
  { icon: 'home-city-outline' as const, label: 'Center status', route: '/(resident)/center-status' },
];

type ActiveDisaster = {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'Upcoming' | 'Active' | 'Archived';
  affected_areas: number;
  started_at: string | null;
};

type ResidentEvacuationStatus = {
  status: 'not_registered' | 'registered' | 'checked_in' | 'evacuated' | 'released';
  householdCount: number;
};

export default function ResidentDashboard() {
  const [activeDisaster, setActiveDisaster] = useState<ActiveDisaster | null>(null);
  const [isDisasterLoading, setIsDisasterLoading] = useState(true);
  const [disasterError, setDisasterError] = useState(false);
  const { weather, presentation, isLoading: isWeatherLoading, isUnavailable: weatherError, now } = useWeather();
  const [evacuationStatus, setEvacuationStatus] = useState<ResidentEvacuationStatus | null>(null);
  const [evacuationStatusUnavailable, setEvacuationStatusUnavailable] = useState(false);

  useEffect(() => {
    const loadActiveDisaster = async () => {
      try {
        const response = await authenticatedFetch('/api/v1/disasters');
        if (!response.ok) throw new Error('Disaster request failed');
        const events = await response.json() as ActiveDisaster[];
        const current = events.find((event) => event.status.toLowerCase() === 'active') ?? null;
        setActiveDisaster(current);
        setDisasterError(false);
      } catch {
        setDisasterError(true);
      } finally {
        setIsDisasterLoading(false);
      }
    };

    void loadActiveDisaster();
    const refresh = setInterval(() => void loadActiveDisaster(), 60_000);
    return () => clearInterval(refresh);
  }, []);

  useEffect(() => {
    const loadEvacuationStatus = async () => {
      try {
        const response = await authenticatedFetch('/api/v1/resident/evacuation-status');
        if (!response.ok) throw new Error('Evacuation status request failed');
        setEvacuationStatus(await response.json() as ResidentEvacuationStatus);
        setEvacuationStatusUnavailable(false);
      } catch {
        setEvacuationStatusUnavailable(true);
      }
    };
    void loadEvacuationStatus();
    const refresh = setInterval(() => void loadEvacuationStatus(), 15000);
    return () => clearInterval(refresh);
  }, []);

  const timePresentation = getTimeOfDayPresentation(now);
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(now);
  const greeting = getGreeting(now);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: timePresentation.pageBackground }]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.brandRow}><Text style={styles.brand}>HANDA</Text></View>
          <NotificationBell />
        </View>

        <View style={styles.greeting}>
          <View>
            <Text style={styles.greetingTitle}>{greeting}, Biñanense!</Text>
            <Text style={styles.greetingDate}>{formattedDate}</Text>
          </View>
          <View style={[styles.weatherIcon, { borderColor: presentation.accent, backgroundColor: '#FFFFFF' }]} accessibilityLabel={`${presentation.description}, ${Math.round(weather.temperature)} degrees`}><MaterialCommunityIcons name={presentation.icon} size={26} color={presentation.accent} /></View>
        </View>

        <WeatherWidget weather={weather} presentation={presentation} isLoading={isWeatherLoading} isUnavailable={weatherError} time={now} disasterActive={!!activeDisaster} />

        <ActiveDisasterCard
          active={!!activeDisaster}
          title={isDisasterLoading ? 'Checking disaster status...' : activeDisaster?.name || 'No active disaster'}
          description={disasterError ? 'Live status unavailable' : activeDisaster ? 'Active Disaster' : 'Monitoring live reports'}
        />

        <View style={styles.statusRow}>
          <StatusTile
            icon="account-outline"
            title="MY STATUS"
            detail={evacuationStatusUnavailable ? 'Unavailable' : !evacuationStatus ? 'Loading...' : evacuationStatus.status === 'not_registered' ? 'Not registered' : evacuationStatus.status.replace('_', ' ')}
            onPress={() => router.push('/(resident)/verify-status')}
          />
          <StatusTile
            icon="account-multiple-outline"
            title="HOUSEHOLD"
            detail={evacuationStatusUnavailable ? 'Unavailable' : !evacuationStatus ? 'Loading...' : `${evacuationStatus.householdCount} ${evacuationStatus.householdCount === 1 ? 'member' : 'members'}`}
            onPress={() => router.push('/(resident)/verify-status')}
          />
        </View>

        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        <View style={styles.actionGrid}>{actions.map((action) => <AnimatedPressable key={action.label} style={styles.actionButton} onPress={() => router.push(action.route)}><Text style={styles.actionLabel}>{action.label}</Text><MaterialCommunityIcons name={action.icon} size={32} color="#218B25" style={styles.actionIcon} /></AnimatedPressable>)}</View>
        <View style={styles.resourceRow}>
          <ResourceButton
            icon="phone-in-talk-outline"
            title="Emergency Hotline"
            detail="Contact list"
            onPress={() => router.push('/(resident)/emergency-contacts')}
          />
          <ResourceButton
            icon="book-open-page-variant-outline"
            title="Preparation Guide"
            detail="Disaster readiness"
            onPress={() => router.push('/(resident)/preparedness-guide')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusTile({ icon, title, detail, onPress }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; title: string; detail: string; onPress: () => void }) {
  return <AnimatedPressable style={styles.statusTile} onPress={onPress}><MaterialCommunityIcons name={icon} size={29} color="#1E5987" /><View style={styles.statusCopy}><Text style={styles.statusTitle}>{title}</Text><Text style={styles.statusDetail}>{detail}</Text></View></AnimatedPressable>;
}

function ResourceButton({ icon, title, detail, onPress }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; title: string; detail: string; onPress: () => void }) {
  return <AnimatedPressable style={styles.resourceButton} onPress={onPress}><View style={styles.resourceCopy}><Text style={styles.resourceTitle}>{title}</Text><Text style={styles.resourceDetail}>{detail}</Text></View><MaterialCommunityIcons name={icon} size={28} color="#218B25" /></AnimatedPressable>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.white },
  container: { flex: 1, backgroundColor: Colors.white },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: 22 },
  header: { height: 86, paddingHorizontal: 18, backgroundColor: '#218B25', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brand: { color: Colors.white, fontSize: 32, fontWeight: '800', letterSpacing: 1 },
  notificationButton: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  notificationDot: { position: 'absolute', top: 6, right: 5, width: 6, height: 6, borderRadius: 3, backgroundColor: '#F5D14B' },
  greeting: { minHeight: 55, paddingHorizontal: 18, paddingTop: 11, paddingBottom: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greetingTitle: { color: '#187821', fontSize: 15, fontWeight: '800' },
  greetingDate: { color: '#187821', fontSize: 9, fontWeight: '600', marginTop: 4 },
  weatherIcon: { width: 29, height: 29, borderRadius: 16, borderWidth: 2, borderColor: '#E3A02C', backgroundColor: '#FFD477', alignItems: 'center', justifyContent: 'center' },
  weatherCard: { minHeight: 112, marginHorizontal: 18, marginTop: 2, marginBottom: 9, borderRadius: 8, overflow: 'hidden' },
  weatherGradient: { flex: 1, minHeight: 112, paddingHorizontal: 14, paddingVertical: 12, overflow: 'hidden' },
  backgroundGlyph: { position: 'absolute', right: -12, bottom: -22 },
  weatherCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  weatherEyebrow: { color: 'rgba(255,255,255,0.78)', fontSize: 8, fontWeight: '800', letterSpacing: 1.2 },
  weatherLocation: { color: Colors.white, fontSize: 11, fontWeight: '700', marginTop: 2 },
  weatherMain: { flexDirection: 'row', alignItems: 'baseline', gap: 9 },
  temperature: { color: Colors.white, fontSize: 20, fontWeight: '800' },
  weatherDescription: { color: '#D8E8F4', fontSize: 9, marginTop: 2 },
  weatherMeta: { color: '#F3FAFF', fontSize: 9, marginTop: 9 },
  tipCard: { minHeight: 62, marginHorizontal: 18, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 10, borderLeftWidth: 4, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.78)', flexDirection: 'row', alignItems: 'center' },
  tipCopy: { flex: 1, marginLeft: 9 },
  tipTitle: { color: '#345044', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  tipText: { color: '#40544A', fontSize: 10, lineHeight: 15, marginTop: 3 },
  disasterCard: { minHeight: 61, marginHorizontal: 18, marginTop: 0, marginBottom: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#D63F43', flexDirection: 'row', alignItems: 'center' },
  disasterCardActive: { minHeight: 102, marginBottom: 12, paddingHorizontal: 14, borderRadius: 9 },
  disasterCardEmpty: { backgroundColor: '#6B7B85' },
  disasterCardHovered: { transform: [{ translateY: -3 }], shadowColor: '#8F252A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.24, shadowRadius: 8, elevation: 6 },
  alertIcon: { width: 38, height: 38, borderWidth: 3, borderColor: Colors.white, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  disasterCopy: { flex: 1, marginLeft: 10 },
  disasterName: { color: Colors.white, fontSize: 14, fontWeight: '800' },
  disasterNameActive: { fontSize: 18, fontWeight: '700' },
  disasterStatus: { color: Colors.white, fontSize: 9, marginTop: 2 },
  disasterStatusActive: { fontSize: 12 },
  statusRow: { flexDirection: 'row', gap: 9, marginHorizontal: 18, marginBottom: 14 },
  statusTile: { flex: 1, minHeight: 70, paddingHorizontal: 8, borderRadius: 8, backgroundColor: '#EEF2EF', flexDirection: 'row', alignItems: 'center' },
  statusCopy: { marginLeft: 8 },
  statusTitle: { color: '#1E5987', fontSize: 10, fontWeight: '800' },
  statusDetail: { color: '#218B25', fontSize: 9, marginTop: 3 },
  resourceRow: { gap: 9, marginHorizontal: 18, marginTop: 10, marginBottom: 14 },
  resourceButton: { minHeight: 46, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#EEF2EF', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  resourceCopy: { flex: 1, marginRight: 8 },
  resourceTitle: { color: '#218B25', fontSize: 9, fontWeight: '800', flexShrink: 1 },
  resourceDetail: { color: '#4C7750', fontSize: 9, marginTop: 2 },
  sectionTitle: { color: '#218B25', fontSize: 16, fontWeight: '800', marginHorizontal: 18, marginTop: 0, marginBottom: 8 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginHorizontal: 18 },
  actionButton: { width: '48%', height: 74, borderRadius: 8, backgroundColor: '#EEF2EF', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: 'transparent' },
  actionButtonHovered: { transform: [{ translateY: -3 }], backgroundColor: '#FFFFFF', borderColor: '#8BC58B', shadowColor: '#1769AA', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.16, shadowRadius: 7, elevation: 5 },
  buttonPressed: { transform: [{ translateY: 1 }] },
  actionLabel: { color: '#218B25', fontSize: 11, fontWeight: '700', flexShrink: 1 },
  actionIcon: { alignSelf: 'flex-end' },
});
