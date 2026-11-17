import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Linking, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText as Text } from '@components/ThemedText';
import { AppBoldFontFamily, AppHeadingFontFamily, AppMediumFontFamily, AppSemiboldFontFamily } from '@constants/typography';
import { PulseDot } from '@components/IncidentCardKit';
import type { LiveTyphoon } from '@/types/weather';

const PAGASA_BULLETIN_URL = 'https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin';

function formatUpdateTime(value: string | null): string {
  if (!value) return 'Update time unavailable';
  const timestamp = /Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Update time unavailable';
  return `Updated ${new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date)} UTC`;
}

function StormMetric({ label, value, icon, wide }: { label: string; value: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; wide: boolean }) {
  return (
    <View style={[styles.metric, { width: wide ? '24%' : '48%' }]}>
      <View style={styles.metricHeading}>
        <MaterialCommunityIcons name={icon} size={14} color="#A8D4F1" />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export function TyphoonCard({ typhoon }: { typhoon: LiveTyphoon }) {
  const { width } = useWindowDimensions();
  const wide = width >= 620;
  const compact = width < 380;
  const horizontalMargin = Math.max(12, Math.min(20, width * 0.045));
  const cardWidth = Math.min(760, width - horizontalMargin * 2);
  const isInsidePar = typhoon.par_status === 'Inside PAR';
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(Animated.timing(rotation, {
      toValue: 1,
      duration: 36_000,
      easing: Easing.linear,
      useNativeDriver: true,
    }));
    animation.start();
    return () => animation.stop();
  }, [rotation]);

  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[styles.cardFrame, { width: cardWidth }]}>
      <LinearGradient
        colors={['#101D34', '#183653', '#1A3D56']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { padding: compact ? 15 : 19 }]}
      >
        <Animated.View pointerEvents="none" style={[styles.stormGlyph, { transform: [{ rotate: spin }] }]}>
          <MaterialCommunityIcons name="weather-hurricane" size={wide ? 220 : 184} color="rgba(157,205,237,0.11)" />
        </Animated.View>
        <View pointerEvents="none" style={styles.glow} />

        <View style={styles.topRow}>
          <View style={styles.liveBadge}>
            <PulseDot color="#FFA58F" size={6} />
            <Text style={styles.liveText}>LIVE STORM TRACK</Text>
          </View>
          <View style={[styles.parBadge, isInsidePar ? styles.parBadgeInside : styles.parBadgeOutside]}>
            <MaterialCommunityIcons name={isInsidePar ? 'map-marker-alert-outline' : 'map-marker-outline'} size={13} color={isInsidePar ? '#FFD0C3' : '#B8DCF4'} />
            <Text style={[styles.parText, isInsidePar ? styles.parTextInside : styles.parTextOutside]}>
              {isInsidePar ? 'INSIDE PAR' : 'OUTSIDE PAR'}
            </Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons name="weather-hurricane" size={compact ? 23 : 27} color="#FFD0C3" />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.classification} numberOfLines={1}>{typhoon.classification.toUpperCase()}</Text>
            <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={1}>{typhoon.international_name}</Text>
          </View>
        </View>

        <Text style={styles.updated}>{formatUpdateTime(typhoon.updated_at)}</Text>

        <View style={styles.metrics}>
          <StormMetric
            label="MAXIMUM WIND"
            value={typhoon.max_wind_kmh === null ? 'Not reported' : `${typhoon.max_wind_kmh} km/h`}
            icon="weather-windy"
            wide={wide}
          />
          <StormMetric
            label="GUSTS"
            value={typhoon.gust_speed_kmh === null ? 'Not reported' : `${typhoon.gust_speed_kmh} km/h`}
            icon="weather-windy-variant"
            wide={wide}
          />
          <StormMetric
            label="PAGASA SIGNAL"
            value={typhoon.signal_no === null ? (isInsidePar ? 'Check latest bulletin' : 'Not issued outside PAR') : `No. ${typhoon.signal_no}`}
            icon="bullhorn-outline"
            wide={wide}
          />
          <StormMetric label="TRACK SOURCE" value={typhoon.data_source} icon="satellite-variant" wide={wide} />
        </View>

        <View style={styles.links}>
          <Pressable
            style={styles.linkButton}
            onPress={() => void Linking.openURL(typhoon.source_url)}
            accessibilityRole="link"
            accessibilityLabel="Open tropical storm track details"
          >
            <MaterialCommunityIcons name="map-search-outline" size={16} color="#D9EEFC" />
            <Text style={styles.linkText}>Track details</Text>
            <MaterialCommunityIcons name="open-in-new" size={13} color="#A8D4F1" />
          </Pressable>
          <Pressable
            style={styles.linkButton}
            onPress={() => void Linking.openURL(PAGASA_BULLETIN_URL)}
            accessibilityRole="link"
            accessibilityLabel="Open the latest PAGASA severe weather bulletin"
          >
            <MaterialCommunityIcons name="shield-check-outline" size={16} color="#FFD0C3" />
            <Text style={styles.linkText}>PAGASA bulletin</Text>
            <MaterialCommunityIcons name="open-in-new" size={13} color="#A8D4F1" />
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  cardFrame: {
    alignSelf: 'center',
    maxWidth: 760,
    marginBottom: 14,
    borderRadius: 24,
    shadowColor: '#0A1B2C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  card: {
    minHeight: 250,
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(190,221,242,0.22)',
  },
  stormGlyph: { position: 'absolute', right: -44, top: 43 },
  glow: {
    position: 'absolute',
    top: -90,
    right: 38,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(97,152,195,0.11)',
  },
  topRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 27,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  liveText: { color: '#E8F4FD', fontFamily: AppBoldFontFamily, fontSize: 9, letterSpacing: 0.9 },
  parBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 27, paddingHorizontal: 9, borderRadius: 20, borderWidth: 1 },
  parBadgeInside: { backgroundColor: 'rgba(220,108,93,0.17)', borderColor: 'rgba(255,184,164,0.3)' },
  parBadgeOutside: { backgroundColor: 'rgba(125,181,218,0.12)', borderColor: 'rgba(168,212,241,0.25)' },
  parText: { fontFamily: AppBoldFontFamily, fontSize: 9, letterSpacing: 0.65 },
  parTextInside: { color: '#FFD0C3' },
  parTextOutside: { color: '#C4E4F8' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  heroIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255,174,151,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,193,174,0.27)',
  },
  heroCopy: { flex: 1, minWidth: 0 },
  classification: { color: '#B9D9EF', fontFamily: AppBoldFontFamily, fontSize: 10, letterSpacing: 1.5 },
  name: { color: '#FFFFFF', fontFamily: AppHeadingFontFamily, fontSize: 25, letterSpacing: 0.2, marginTop: 1 },
  nameCompact: { fontSize: 21 },
  updated: { color: '#BDD2E2', fontFamily: AppMediumFontFamily, fontSize: 11, marginTop: 6, marginBottom: 13 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  metric: {
    minHeight: 62,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.075)',
    borderWidth: 1,
    borderColor: 'rgba(202,226,242,0.12)',
  },
  metricHeading: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metricLabel: { color: '#B9D3E5', fontFamily: AppBoldFontFamily, fontSize: 8, letterSpacing: 0.8 },
  metricValue: { color: '#FFFFFF', fontFamily: AppSemiboldFontFamily, fontSize: 13, marginTop: 4 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 },
  linkButton: {
    flexGrow: 1,
    flexBasis: 132,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(205,228,244,0.2)',
  },
  linkText: { color: '#F5FAFE', fontFamily: AppSemiboldFontFamily, fontSize: 11 },
});
