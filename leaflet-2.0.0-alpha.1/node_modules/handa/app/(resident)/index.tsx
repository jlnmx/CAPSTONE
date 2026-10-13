import React from 'react';
import { useEffect, useState } from 'react';
import { ColorValue, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Moon, Sun, Sunrise, Sunset } from 'lucide-react-native';
import { router } from 'expo-router';
import { useWeather } from '@hooks/useWeather';
import { WeatherWidget } from '@components/WeatherWidget';
import { Colors, getReadableColor } from '@constants/colors';
import { useTheme } from '@hooks/useTheme';
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

type ResidentStatusStyle = { backgroundColor: ColorValue; iconColor: ColorValue; textColor: ColorValue };

export default function ResidentDashboard() {
  const { resolvedTheme } = useTheme();
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
        const current = events.find((event) => event.status.toLowerCase() === 'active')
          ?? events.find((event) => event.status.toLowerCase() === 'upcoming')
          ?? null;
        setActiveDisaster(current);
        setDisasterError(false);
      } catch {
        setDisasterError(true);
      } finally {
        setIsDisasterLoading(false);
      }
    };

    void loadActiveDisaster();
    const refresh = setInterval(() => void loadActiveDisaster(), 15_000);
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

  const disasterIsActive = activeDisaster?.status.toLowerCase() === 'active';
  const timePresentation = getTimeOfDayPresentation(now);
  const GreetingIcon = timePresentation.label === 'Dawn'
    ? Sunrise
    : timePresentation.label === 'Dusk'
      ? Sunset
      : timePresentation.label === 'Night'
        ? Moon
        : Sun;
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
          <View style={[styles.weatherIcon, { borderColor: getReadableColor(presentation.accent, resolvedTheme), backgroundColor: Colors.surface }]} accessibilityLabel={`${timePresentation.label}, ${presentation.description}, ${Math.round(weather.temperature)} degrees`}><GreetingIcon size={23} color={getReadableColor(presentation.accent, resolvedTheme)} strokeWidth={2.5} /></View>
        </View>

        <WeatherWidget weather={weather} presentation={presentation} isLoading={isWeatherLoading} isUnavailable={weatherError} time={now} disasterActive={disasterIsActive} />

        <ActiveDisasterCard
          active={disasterIsActive}
          upcoming={activeDisaster?.status.toLowerCase() === 'upcoming'}
          title={isDisasterLoading ? 'Checking disaster status...' : activeDisaster?.name || 'No active disaster'}
          description={disasterError ? 'Live status unavailable' : activeDisaster ? `${activeDisaster.status.toUpperCase()} · ${activeDisaster.severity.toUpperCase()} · ${activeDisaster.affected_areas} affected areas${activeDisaster.description ? ` · ${activeDisaster.description}` : ''}` : 'Monitoring live reports'}
        />

        <View style={styles.statusRow}>
          <StatusTile
            icon="account-outline"
            title="MY STATUS"
            detail={getResidentStatusLabel(evacuationStatusUnavailable, evacuationStatus)}
            status={getResidentStatusStyle(evacuationStatusUnavailable, evacuationStatus, resolvedTheme)}
          />
          <StatusTile
            icon="account-multiple-outline"
            title="HOUSEHOLD"
            detail={evacuationStatusUnavailable ? 'Unavailable' : !evacuationStatus ? 'Loading...' : `${evacuationStatus.householdCount} ${evacuationStatus.householdCount === 1 ? 'member' : 'members'}`}
            onPress={() => router.push('/(resident)/household')}
          />
        </View>

        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        <View style={styles.actionGrid}>{actions.map((action) => <AnimatedPressable key={action.label} style={styles.actionButton} onPress={() => router.push(action.route)}><Text style={styles.actionLabel}>{action.label}</Text><MaterialCommunityIcons name={action.icon} size={32} color={getReadableColor('#218B25', resolvedTheme)} style={styles.actionIcon} /></AnimatedPressable>)}</View>
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

function getResidentStatusLabel(unavailable: boolean, status: ResidentEvacuationStatus | null): string {
  if (unavailable) return 'Unavailable';
  if (!status || status.status === 'not_registered') return 'SAFE';
  return status.status === 'checked_in' ? 'CHECKED-IN' : status.status.toUpperCase();
}

function getResidentStatusStyle(unavailable: boolean, status: ResidentEvacuationStatus | null, theme: 'light' | 'dark'): ResidentStatusStyle {
  const selected = unavailable
    ? ['#A34545', '#8D3C3C']
    : !status || status.status === 'not_registered'
      ? ['#218B25', '#176B1D']
      : status.status === 'checked_in'
        ? ['#1769AA', '#175384']
        : status.status === 'evacuated'
          ? ['#B36E00', '#8A5700']
          : ['#667085', '#52606D'];
  return {
    backgroundColor: Colors.surfaceMuted,
    iconColor: getReadableColor(selected[0], theme),
    textColor: selected[1],
  };
}

function StatusTile({ icon, title, detail, onPress, status }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; title: string; detail: string; onPress?: () => void; status?: ResidentStatusStyle }) {
  const { resolvedTheme } = useTheme();
  const content = <><MaterialCommunityIcons name={icon} size={29} color={status?.iconColor ?? getReadableColor('#1E5987', resolvedTheme)} /><View style={styles.statusCopy}><Text style={[styles.statusTitle, { color: status?.textColor ?? '#1E5987' }]}>{title}</Text><Text style={[styles.statusDetail, { color: status?.textColor ?? '#1E5987' }]}>{detail}</Text></View></>;
  return onPress ? <AnimatedPressable style={[styles.statusTile, status && { backgroundColor: status.backgroundColor }]} onPress={onPress}>{content}</AnimatedPressable> : <View style={[styles.statusTile, status && { backgroundColor: status.backgroundColor }]} accessibilityRole="text">{content}</View>;
}

function ResourceButton({ icon, title, detail, onPress }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; title: string; detail: string; onPress: () => void }) {
  const { resolvedTheme } = useTheme();
  const accent = getReadableColor('#218B25', resolvedTheme);
  return <AnimatedPressable style={styles.resourceButton} onPress={onPress}><View style={styles.resourceCopy}><Text style={[styles.resourceTitle, { color: accent }]}>{title}</Text><Text style={styles.resourceDetail}>{detail}</Text></View><MaterialCommunityIcons name={icon} size={28} color={accent} /></AnimatedPressable>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  container: { flex: 1, backgroundColor: Colors.surface },
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
  tipTitle: { color: Colors.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  tipText: { color: Colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 3 },
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
  statusTile: { flex: 1, minHeight: 70, paddingHorizontal: 8, borderRadius: 8, backgroundColor: Colors.surfaceMuted, flexDirection: 'row', alignItems: 'center' },
  statusCopy: { marginLeft: 8 },
  statusTitle: { color: '#1E5987', fontSize: 10, fontWeight: '800' },
  statusDetail: { color: '#218B25', fontSize: 9, marginTop: 3 },
  resourceRow: { gap: 9, marginHorizontal: 18, marginTop: 10, marginBottom: 14 },
  resourceButton: { minHeight: 46, paddingHorizontal: 10, borderRadius: 8, backgroundColor: Colors.surfaceMuted, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  resourceCopy: { flex: 1, marginRight: 8 },
  resourceTitle: { color: '#218B25', fontSize: 9, fontWeight: '800', flexShrink: 1 },
  resourceDetail: { color: Colors.textMuted, fontSize: 9, marginTop: 2 },
  sectionTitle: { color: '#218B25', fontSize: 16, fontWeight: '800', marginHorizontal: 18, marginTop: 0, marginBottom: 8 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginHorizontal: 18 },
  actionButton: { width: '48%', height: 74, borderRadius: 8, backgroundColor: Colors.surfaceMuted, justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: 'transparent' },
  actionButtonHovered: { transform: [{ translateY: -3 }], backgroundColor: Colors.surface, borderColor: '#8BC58B', shadowColor: '#1769AA', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.16, shadowRadius: 7, elevation: 5 },
  buttonPressed: { transform: [{ translateY: 1 }] },
  actionLabel: { color: '#218B25', fontSize: 11, fontWeight: '700', flexShrink: 1 },
  actionIcon: { alignSelf: 'flex-end' },
});
