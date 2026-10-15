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
import { TyphoonCard } from '@components/TyphoonCard';
import { authenticatedFetch } from '@services/apiClient';
import { useAuth } from '@hooks/useAuth';
import { getGreeting, getTimeOfDayPresentation } from '@utils/weatherTime';
import type { LiveTyphoon, LiveTyphoonReport } from '@types/weather';
import type { ResidentHouseholdMember } from '@types/index';

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
  members?: ResidentHouseholdMember[];
};

type ResidentStatusStyle = { backgroundColor: ColorValue; iconColor: ColorValue; textColor: ColorValue };

export default function ResidentDashboard() {
  const { resolvedTheme } = useTheme();
  const { user } = useAuth();
  const [activeDisaster, setActiveDisaster] = useState<ActiveDisaster | null>(null);
  const [disasterError, setDisasterError] = useState(false);
  const { weather, weatherEvents, presentation, isLoading: isWeatherLoading, isUnavailable: weatherError, now } = useWeather();
  const [liveTyphoons, setLiveTyphoons] = useState<LiveTyphoon[]>([]);
  const [typhoonReport, setTyphoonReport] = useState<LiveTyphoonReport | null>(null);
  const [typhoonFeedLoading, setTyphoonFeedLoading] = useState(true);
  const [typhoonFeedUnavailable, setTyphoonFeedUnavailable] = useState(false);
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
      }
    };

    void loadActiveDisaster();
    const refresh = setInterval(() => void loadActiveDisaster(), 15_000);
    return () => clearInterval(refresh);
  }, []);

  useEffect(() => {
    const loadLiveTyphoons = async () => {
      try {
        const response = await authenticatedFetch('/api/v1/typhoons');
        if (!response.ok) throw new Error('Live typhoon feed request failed');
        const result = await response.json() as LiveTyphoonReport;
        setTyphoonReport(result);
        setLiveTyphoons(result.storms);
        setTyphoonFeedUnavailable(false);
        setTyphoonFeedLoading(false);
      } catch {
        setTyphoonFeedUnavailable(true);
        setTyphoonFeedLoading(false);
      }
    };

    void loadLiveTyphoons();
    const refresh = setInterval(() => void loadLiveTyphoons(), 5 * 60 * 1000);
    return () => clearInterval(refresh);
  }, []);

  useEffect(() => {
    const loadEvacuationStatus = async () => {
      try {
        const [response, profileResponse] = await Promise.all([
          authenticatedFetch('/api/v1/resident/evacuation-status'),
          authenticatedFetch('/api/v1/auth/me').catch(() => null),
        ]);
        if (!response.ok) throw new Error('Evacuation status request failed');
        const status = await response.json() as ResidentEvacuationStatus;
        const profile = profileResponse?.ok
          ? await profileResponse.json() as { householdMembers?: ResidentHouseholdMember[] }
          : null;
        const memberKeys = new Set<string>();
        for (const member of [...(profile?.householdMembers ?? user?.householdMembers ?? []), ...(status.members ?? [])]) {
          memberKeys.add(`${member.name.trim().toLocaleLowerCase()}|${member.relationship.trim().toLocaleLowerCase()}`);
        }
        const reportedCount = Number(status.householdCount);
        setEvacuationStatus({
          ...status,
          householdCount: Math.max(memberKeys.size + 1, Number.isFinite(reportedCount) ? reportedCount : 0, 1),
        });
        setEvacuationStatusUnavailable(false);
      } catch {
        setEvacuationStatusUnavailable(true);
      }
    };
    void loadEvacuationStatus();
    const refresh = setInterval(() => void loadEvacuationStatus(), 15000);
    return () => clearInterval(refresh);
  }, [user?.householdMembers]);

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

        <WeatherWidget weather={weather} weatherEvents={weatherEvents} presentation={presentation} isLoading={isWeatherLoading} isUnavailable={weatherError} time={now} disasterActive={disasterIsActive} />

        {disasterIsActive && activeDisaster && (
          <ActiveDisasterCard
            active
            title={activeDisaster.name}
            description={disasterError ? 'Live status unavailable' : `${activeDisaster.status.toUpperCase()} · ${activeDisaster.severity.toUpperCase()} · ${activeDisaster.affected_areas} affected areas${activeDisaster.description ? ` · ${activeDisaster.description}` : ''}`}
          />
        )}
        {liveTyphoons.map((typhoon) => <TyphoonCard key={typhoon.id} typhoon={typhoon} />)}
        {typhoonFeedUnavailable && <Text style={styles.forecastFeedWarning}>Live tropical cyclone feed unavailable. Check the PAGASA bulletin.</Text>}
        {!typhoonFeedUnavailable && typhoonFeedLoading && <Text style={styles.forecastFeedStatus}>Checking the current PAGASA bulletin...</Text>}
        {!typhoonFeedUnavailable && !typhoonFeedLoading && typhoonReport && liveTyphoons.length === 0 && (
          <View style={styles.forecastFeedStatus}>
            <Text style={styles.forecastFeedTitle}>{typhoonReport.laguna_signal_no === 0 ? 'NO ACTIVE TROPICAL CYCLONE' : 'CYCLONE DETAILS UNAVAILABLE'}</Text>
            <Text style={styles.forecastFeedDetail}>International name: {typhoonReport.laguna_signal_no === 0 ? 'None' : 'Check PAGASA bulletin'}</Text>
            <Text style={styles.forecastFeedDetail}>Classification: {typhoonReport.laguna_signal_no === 0 ? 'None' : 'Not confirmed'}</Text>
            <Text style={styles.forecastFeedDetail}>Maximum wind / gust: {typhoonReport.laguna_signal_no === 0 ? 'Not applicable' : 'Not reported'}</Text>
            <Text style={styles.forecastFeedDetail}>Laguna: {typhoonReport.laguna_signal_no === 0 ? 'Signal No. 0' : 'Check current PAGASA signal'}</Text>
            <Text style={styles.forecastFeedSource}>PAGASA · checked {new Date(typhoonReport.checked_at).toLocaleTimeString()}</Text>
          </View>
        )}

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
  greetingTitle: { color: '#218B25', fontSize: 15, fontWeight: '800' },
  greetingDate: { color: '#218B25', fontSize: 9, fontWeight: '600', marginTop: 4 },
  weatherIcon: { width: 29, height: 29, borderRadius: 16, borderWidth: 2, borderColor: '#E3A02C', backgroundColor: '#FFD477', alignItems: 'center', justifyContent: 'center' },
  forecastFeedWarning: { marginHorizontal: 18, marginBottom: 10, color: '#8C302B', fontSize: 10 },
  forecastFeedStatus: { marginHorizontal: 18, marginBottom: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: '#287A54', backgroundColor: '#EAF5EE' },
  forecastFeedTitle: { color: '#205C3F', fontSize: 10, fontWeight: '800' },
  forecastFeedDetail: { color: Colors.text, fontSize: 10, marginTop: 3 },
  forecastFeedSource: { color: Colors.textMuted, fontSize: 8, marginTop: 6 },
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
