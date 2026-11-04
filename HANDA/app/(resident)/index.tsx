import React from 'react';
import { useEffect, useState } from 'react';
import { ColorValue, SafeAreaView, ScrollView, StyleSheet, View, Animated } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useWeather } from '@hooks/useWeather';
import { WeatherWidget } from '@components/WeatherWidget';
import { Colors, getReadableColor } from '@constants/colors';
import { useTheme } from '@hooks/useTheme';
import { NotificationBell } from '@components/NotificationBell';
import AppBackArrow from '@components/AppBackArrow';
import { AnimatedPressable } from '@components/Buttons';
import { ActiveDisasterCard } from '@components/ActiveDisasterCard';
import { TyphoonCard } from '@components/TyphoonCard';
import { authenticatedFetch } from '@services/apiClient';
import { useAuth } from '@hooks/useAuth';
import { getFirstName, getGreeting, getTimeOfDayPresentation } from '@utils/weatherTime';
import type { LiveTyphoon } from '@types/weather';
import type { ResidentHouseholdMember } from '@types/index';

const actions: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; mark: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; route: string; tone: 'forest' | 'teal' | 'sand' | 'clay' }[] = [
  { icon: 'account-plus-outline', mark: 'account-group-outline', label: 'Register Evacuee', route: '/(resident)/register-evacuee', tone: 'forest' },
  { icon: 'checkbox-marked-outline', mark: 'map-marker-check-outline', label: 'Verify Check-in', route: '/(resident)/verify-status', tone: 'teal' },
  { icon: 'alert-circle-outline', mark: 'alert-octagon-outline', label: 'Report incident', route: '/(resident)/report', tone: 'clay' },
  { icon: 'home-city-outline', mark: 'home-city-outline', label: 'Center status', route: '/(resident)/center-status', tone: 'sand' },
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
        const result = await response.json() as { storms: LiveTyphoon[] };
        setLiveTyphoons(result.storms);
      } catch {
        setLiveTyphoons([]);
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
          <View style={styles.brandRow}><AppBackArrow /><Text style={styles.brand}>HANDA</Text></View>
          <NotificationBell />
        </View>

        <View style={styles.greeting}>
          <View>
            <Text style={styles.greetingTitle}>{greeting}, {getFirstName(user, 'Biñanense')}!</Text>
            <Text style={styles.greetingDate}>{formattedDate}</Text>
          </View>
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

        <View style={styles.statusRow}>
          <StatusTile
            tone="forest"
            icon="shield-check-outline"
            mark="shield-outline"
            title="MY STATUS"
            detail={getResidentStatusLabel(evacuationStatusUnavailable, evacuationStatus)}
          />
          <StatusTile
            tone="sand"
            icon="account-multiple-outline"
            mark="home-group"
            title="HOUSEHOLD"
            detail={evacuationStatusUnavailable ? 'Unavailable' : !evacuationStatus ? 'Loading...' : `${evacuationStatus.householdCount} ${evacuationStatus.householdCount === 1 ? 'member' : 'members'}`}
            onPress={() => router.push('/(resident)/household')}
          />
        </View>

        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        <View style={styles.actionGrid}>{actions.map((action) => <DashTile key={action.label} tone={action.tone} icon={action.icon} mark={action.mark} title={action.label} onPress={() => router.push(action.route)} style={styles.actionButton} />)}</View>
        <View style={styles.resourceRow}>
          <ResourceButton
            tone="clay"
            icon="phone-in-talk-outline"
            mark="bullhorn-outline"
            title="Emergency Hotline"
            detail="Contact list"
            onPress={() => router.push('/(resident)/emergency-contacts')}
          />
          <ResourceButton
            tone="sand"
            icon="book-open-page-variant-outline"
            mark="book-open-page-variant-outline"
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

type TileTone = { bg: string; fg: string; badgeBg: string; badgeFg: string; mark: string };
const TONES: Record<'forest' | 'teal' | 'sand' | 'clay', TileTone> = {
  forest: { bg: '#1F6B2B', fg: '#FFFFFF', badgeBg: '#F4F8D8', badgeFg: '#1F6B2B', mark: 'rgba(255,255,255,0.14)' },
  teal: { bg: '#1E4D5C', fg: '#FFFFFF', badgeBg: '#E6F0F3', badgeFg: '#1E4D5C', mark: 'rgba(255,255,255,0.14)' },
  sand: { bg: '#ECE6D6', fg: '#1B3D20', badgeBg: '#1F6B2B', badgeFg: '#FFFFFF', mark: 'rgba(31,107,43,0.12)' },
  clay: { bg: '#C9573F', fg: '#FFFFFF', badgeBg: '#FFF1E8', badgeFg: '#C9573F', mark: 'rgba(255,255,255,0.16)' },
};
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function useHoverLift() {
  const lift = React.useRef(new Animated.Value(0)).current;
  const to = (value: number) => Animated.spring(lift, { toValue: value, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  return { onHoverIn: () => to(1), onHoverOut: () => to(0), transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }, { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }] };
}

function DashTile({ tone, icon, mark, title, detail, onPress, compact, row, style }: { tone: keyof typeof TONES; icon: IconName; mark: IconName; title: string; detail?: string; onPress?: () => void; compact?: boolean; row?: boolean; style?: object }) {
  const hover = useHoverLift();
  const t = TONES[tone];
  const body = <>
    <MaterialCommunityIcons name={mark} size={row ? 56 : compact ? 84 : 104} color={t.mark} style={styles.tileMark} />
    <View style={[styles.tileBadge, row && styles.tileBadgeRow, { backgroundColor: t.badgeBg }]}><MaterialCommunityIcons name={icon} size={row ? 17 : compact ? 20 : 22} color={t.badgeFg} /></View>
    <View style={[styles.tileFooter, row && styles.tileFooterRow]}>
      <View style={styles.tileCopy}>
        <Text style={[styles.tileTitle, { color: t.fg }]} numberOfLines={2}>{title}</Text>
        {detail && !row ? <Text style={[styles.tileDetail, { color: t.fg }]} numberOfLines={1}>{detail}</Text> : null}
      </View>
      {onPress ? <MaterialCommunityIcons name="chevron-right" size={18} color={t.fg} /> : null}
    </View>
  </>;
  const base = [styles.tile, compact && styles.tileCompact, row && styles.tileRow, { backgroundColor: t.bg }, style];
  return onPress
    ? <AnimatedPressable style={[...base, { transform: hover.transform }]} onPress={onPress} onHoverIn={hover.onHoverIn} onHoverOut={hover.onHoverOut} accessibilityRole="button" accessibilityLabel={detail ? `${title}: ${detail}` : title}>{body}</AnimatedPressable>
    : <View style={base} accessibilityRole="text">{body}</View>;
}

function StatusTile({ icon, mark, title, detail, onPress, tone }: { icon: IconName; mark: IconName; title: string; detail: string; onPress?: () => void; tone: keyof typeof TONES }) {
  return <DashTile compact tone={tone} icon={icon} mark={mark} title={title} detail={detail} onPress={onPress} style={styles.statusTile} />;
}

function ResourceButton({ icon, mark, title, detail, onPress, tone }: { icon: IconName; mark: IconName; title: string; detail: string; onPress: () => void; tone: keyof typeof TONES }) {
  return <DashTile compact row tone={tone} icon={icon} mark={mark} title={title} detail={detail} onPress={onPress} style={styles.resourceTile} />;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: 22 },
  header: { height: 86, paddingHorizontal: 18, backgroundColor: '#218B25', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  statusTile: { flex: 1 },
  tile: { minHeight: 112, padding: 14, borderRadius: 22, overflow: 'hidden', justifyContent: 'space-between', shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3 },
  tileCompact: { minHeight: 96, borderRadius: 20 },
  tileMark: { position: 'absolute', right: -14, bottom: -14 },
  tileBadge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  tileFooter: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 12 },
  tileCopy: { flex: 1 },
  tileTitle: { fontSize: 12, fontWeight: '800' },
  tileDetail: { fontSize: 10, fontWeight: '600', marginTop: 2, opacity: 0.9 },
  resourceRow: { flexDirection: 'row', gap: 10, marginHorizontal: 18, marginTop: 14, marginBottom: 14 },
  resourceTile: { flex: 1 },
  tileRow: { minHeight: 56, padding: 10, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 8 },
  tileBadgeRow: { width: 32, height: 32, borderRadius: 16 },
  tileFooterRow: { flex: 1, marginTop: 0, alignItems: 'center' },
  sectionTitle: { color: '#218B25', fontSize: 16, fontWeight: '800', marginHorizontal: 18, marginTop: 0, marginBottom: 10 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, marginHorizontal: 18 },
  actionButton: { width: '48%' },
  actionButtonHovered: { transform: [{ translateY: -3 }], backgroundColor: Colors.surface, borderColor: '#8BC58B', shadowColor: '#1769AA', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.16, shadowRadius: 7, elevation: 5 },
  buttonPressed: { transform: [{ translateY: 1 }] },
  actionLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', flexShrink: 1 },
  actionIcon: { alignSelf: 'flex-end' },
});
