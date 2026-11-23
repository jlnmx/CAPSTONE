import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, NativeScrollEvent, NativeSyntheticEvent, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';
import AppBackArrow from '@components/AppBackArrow';
import { useTheme } from '@hooks/useTheme';
import { fetchGoogleWeatherForecast } from '@services/googleWeather';
import type { GoogleWeatherSnapshot } from '@/types/weather';
import { getWeatherPresentation, getWeatherTileIcon, getWeatherTileTimePresentation } from '@utils/weatherPresentation';

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function displayDate(value: string, includeYear = false): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long', ...(includeYear ? { year: 'numeric' } : {}) }).format(parseLocalDate(value));
}

function displayHour(value: string): string {
  const hour = Number(value.slice(11, 13));
  return `${String(hour).padStart(2, '0')}:00`;
}

function formatTemperature(value: number): string {
  return `${Math.round(value)}°C`;
}

function HourlyForecastStrip({ hours }: { hours: GoogleWeatherSnapshot['hourly'] }) {
  const scrollRef = useRef<ScrollView>(null);
  const offsetRef = useRef(0);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didInitializeRef = useRef(false);
  const [groupWidth, setGroupWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const copyCount = groupWidth && viewportWidth
    ? Math.max(3, Math.ceil(Math.max(0, viewportWidth - 20) / groupWidth) + 2)
    : 3;

  const pause = useCallback(() => {
    pausedRef.current = true;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = null;
  }, []);

  const resumeSoon = useCallback(() => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      pausedRef.current = false;
      resumeTimerRef.current = null;
    }, 1400);
  }, []);

  useEffect(() => {
    if (!groupWidth || !hours.length || didInitializeRef.current) return;
    offsetRef.current = groupWidth;
    scrollRef.current?.scrollTo({ x: groupWidth, animated: false });
    didInitializeRef.current = true;
  }, [groupWidth, hours.length]);

  useEffect(() => {
    if (!groupWidth || contentWidth <= viewportWidth || !viewportWidth || !hours.length) return undefined;

    let frame = 0;
    let previousFrame = 0;
    const start = groupWidth;
    const end = groupWidth * 2;
    const pixelsPerMillisecond = 0.024;

    const tick = (time: number) => {
      if (previousFrame && !pausedRef.current) {
        let nextOffset = offsetRef.current + (time - previousFrame) * pixelsPerMillisecond;
        if (nextOffset >= end) nextOffset = start + ((nextOffset - start) % groupWidth);
        offsetRef.current = nextOffset;
        scrollRef.current?.scrollTo({ x: nextOffset, animated: false });
      }
      previousFrame = time;
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [contentWidth, groupWidth, hours.length, viewportWidth]);

  useEffect(() => () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  }, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    if (!groupWidth) {
      offsetRef.current = x;
      return;
    }

    const start = groupWidth;
    const end = groupWidth * 2;
    if (x < start || x >= end) {
      const wrappedOffset = start + ((x - start) % groupWidth + groupWidth) % groupWidth;
      offsetRef.current = wrappedOffset;
      scrollRef.current?.scrollTo({ x: wrappedOffset, animated: false });
      return;
    }
    offsetRef.current = x;
  }, [groupWidth]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      nestedScrollEnabled
      directionalLockEnabled
      bounces={false}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.hourlyContent}
      onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
      onContentSizeChange={(width) => setContentWidth(width)}
      onScroll={handleScroll}
      onScrollBeginDrag={pause}
      onScrollEndDrag={resumeSoon}
      onMomentumScrollBegin={pause}
      onMomentumScrollEnd={resumeSoon}
      onTouchStart={pause}
      onTouchEnd={resumeSoon}
      scrollEventThrottle={16}
      accessibilityLabel="Hourly weather forecast"
      accessibilityHint="Moves slowly on its own. Swipe to browse the forecast."
    >
      {Array.from({ length: copyCount }, (_, copy) => (
        <View
          key={`hourly-copy-${copy}`}
          style={styles.hourlyCopy}
          onLayout={copy === 0 ? (event) => setGroupWidth(event.nativeEvent.layout.width) : undefined}
        >
          {hours.map((hour) => (
            <View key={`${copy}-${hour.time}`} style={styles.hourItem}>
              <Text style={styles.hourRain}>{hour.precipitationProbability == null ? '--' : `${hour.precipitationProbability}%`}</Text>
              <Text style={styles.hourTime}>{displayHour(hour.time)}</Text>
              <MaterialCommunityIcons name={getWeatherPresentation(hour.conditionType, hour.temperature, hour.isDay, hour.conditionDescription).icon} size={26} color={Colors.secondary} />
              <Text style={styles.hourTemperature}>{formatTemperature(hour.temperature)}</Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

export default function WeatherForecastScreen() {
  const { palette } = useTheme();
  const [forecast, setForecast] = useState<GoogleWeatherSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const loadForecast = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    try {
      const result = await fetchGoogleWeatherForecast(signal);
      if (signal?.aborted) return;
      setForecast(result);
      setError(null);
    } catch (reason) {
      if (signal?.aborted) return;
      setError(reason instanceof Error ? reason.message : 'Unable to load the weather forecast.');
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadForecast(controller.signal);
    return () => controller.abort();
  }, [loadForecast]);

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(clock);
  }, []);

  const today = forecast?.daily[0];
  const presentation = forecast && getWeatherPresentation(forecast.current.conditionType, forecast.current.temperature, forecast.current.isDay, forecast.current.conditionDescription);
  const tileTimePresentation = getWeatherTileTimePresentation(now);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <AppBackArrow style={styles.backButton} />
          <Text style={styles.headerTitle}>Weather</Text>
        </View>

        {isLoading && <View style={styles.centerState}><ActivityIndicator color={Colors.primary} /><Text style={styles.stateText}>Loading weather forecast...</Text></View>}
        {!isLoading && error && (
          <View style={styles.errorCard}>
            <MaterialCommunityIcons name="alert-circle-outline" size={32} color={Colors.emergency} />
            <Text style={styles.errorTitle}>Forecast unavailable</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorText}>Check the HANDA server's Google Weather API configuration and try again.</Text>
            <Pressable onPress={() => void loadForecast()} style={styles.retryButton}><Text darkText style={styles.retryText}>Retry</Text></Pressable>
          </View>
        )}
        {!isLoading && !error && forecast && today && presentation && (
          <>
            <LinearGradient colors={tileTimePresentation.gradient} style={styles.todayCard}>
              <View style={styles.todayHeading}>
                <View><Text darkText style={styles.todayLabel}>Today</Text><Text darkText style={styles.todayDate}>{displayDate(today.date, true)}</Text></View>
                <MaterialCommunityIcons name={getWeatherTileIcon(presentation, now)} size={42} color={Colors.white} />
              </View>
              <View style={styles.todayTemperatureRow}>
                <Text darkText style={styles.todayTemperature}>{formatTemperature(forecast.current.temperature)}</Text>
                <Text darkText style={styles.todayCondition}>{presentation.description}</Text>
              </View>
              <Text darkText style={styles.todayMeta}>Feels like {formatTemperature(forecast.current.feelsLike)}  ·  High {formatTemperature(today.maxTemperature)}  ·  Low {formatTemperature(today.minTemperature)}</Text>
              <Text darkText style={styles.todayMeta}>Humidity {Math.round(forecast.current.humidity)}%  ·  Wind {Math.round(forecast.current.windSpeed)} km/h</Text>
            </LinearGradient>

            {forecast.environmentalRisk
              ? <View style={[styles.riskCard, [styles.riskLevel0, styles.riskLevel1, styles.riskLevel2, styles.riskLevel3, styles.riskLevel4][forecast.environmentalRisk.level]]}>
                <View style={styles.riskHeading}><MaterialCommunityIcons name="leaf" size={19} color={Colors.primary} /><Text style={styles.riskTitle}>Environmental risk · {forecast.environmentalRisk.label}</Text></View>
                <Text style={styles.riskDetail}>Air-quality factor: {forecast.environmentalRisk.airQualityFactor}  ·  Weather factor: {forecast.environmentalRisk.weatherFactor}</Text>
                <Text style={styles.riskDetail}>{forecast.environmentalRisk.basis}</Text>
                <Text style={styles.riskDisclaimer}>Planning indicator only—not an official warning. Follow PAGASA and local authority advisories.</Text>
              </View>
              : forecast.airQualityAvailable
                ? null
                : <View style={styles.riskUnavailable}><MaterialCommunityIcons name="information-outline" size={18} color={Colors.warning} /><Text style={styles.riskDetail}>Air-quality data is unavailable, so the combined environmental risk indicator could not be calculated.</Text></View>}

            <View style={styles.hourlyCard}>
              <HourlyForecastStrip hours={forecast.hourly} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Next 7 days</Text>
              {forecast.daily.map((day) => {
                const expanded = expandedDate === day.date;
                const dayPresentation = getWeatherPresentation(day.conditionType, day.maxTemperature, true, day.conditionDescription);
                return (
                  <Pressable
                    key={day.date}
                    onPress={() => setExpandedDate(expanded ? null : day.date)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    accessibilityLabel={`${displayDate(day.date)} forecast`}
                    style={styles.dayRow}
                  >
                    <View style={styles.dayMain}>
                      <View style={styles.dayCopy}>
                        <Text style={styles.dayDate}>{displayDate(day.date)}</Text>
                        <Text style={styles.dayMeta}>Day: {formatTemperature(day.maxTemperature)}, Night: {formatTemperature(day.minTemperature)}</Text>
                      </View>
                      <MaterialCommunityIcons name={dayPresentation.icon} size={28} color={Colors.secondary} />
                      <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color={Colors.textMuted} />
                    </View>
                    {expanded && (
                      <View style={styles.dayDetails}>
                        <Text style={styles.dayDetail}>{dayPresentation.description}</Text>
                        <Text style={styles.dayDetail}>Chance of rain: {day.precipitationProbability == null ? 'Unavailable' : `${day.precipitationProbability}%`}  ·  Rainfall: {day.precipitationSum == null ? 'Unavailable' : `${day.precipitationSum.toFixed(1)} mm`}</Text>
                        <Text style={styles.dayDetail}>Max wind: {day.windSpeedMax == null ? 'Unavailable' : `${Math.round(day.windSpeedMax)} km/h`}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.attribution}>
              <Text style={styles.googleAttribution}>Google Maps</Text>
            </View>
            <Text style={styles.source}>Not an official warning. Check PAGASA advisories.</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', height: 58, gap: 6 },
  backButton: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  centerState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  stateText: { color: Colors.textMuted, fontSize: 13 },
  errorCard: { alignItems: 'center', padding: 22, borderRadius: 14, backgroundColor: Colors.surface, gap: 8 },
  errorTitle: { color: Colors.text, fontSize: 17, fontWeight: '800' },
  errorText: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  retryButton: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, backgroundColor: Colors.primary },
  retryText: { fontWeight: '800', color: Colors.white },
  todayCard: { minHeight: 196, borderRadius: 14, padding: 18, overflow: 'hidden' },
  todayHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  todayLabel: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  todayDate: { color: '#E1EDF8', fontSize: 11, marginTop: 5 },
  todayTemperatureRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginTop: 20 },
  todayTemperature: { color: Colors.white, fontSize: 40, fontWeight: '800' },
  todayCondition: { color: '#E1EDF8', fontSize: 13, flexShrink: 1 },
  todayMeta: { color: Colors.white, fontSize: 11, marginTop: 8 },
  hourlyCard: { marginTop: 14, borderRadius: 14, backgroundColor: Colors.surface, paddingVertical: 12 },
  hourlyContent: { paddingHorizontal: 10 },
  hourlyCopy: { flexDirection: 'row', flexShrink: 0 },
  hourItem: { width: 58, alignItems: 'center', gap: 5 },
  hourRain: { color: Colors.secondary, fontSize: 10, fontWeight: '700' },
  hourTime: { color: Colors.textMuted, fontSize: 10 },
  hourTemperature: { color: Colors.text, fontSize: 11, fontWeight: '700' },
  section: { marginTop: 14, borderRadius: 14, backgroundColor: Colors.surface, paddingHorizontal: 14 },
  sectionTitle: { color: Colors.text, fontSize: 14, fontWeight: '800', paddingVertical: 14 },
  dayRow: { minHeight: 68, justifyContent: 'center', borderTopWidth: 1, borderTopColor: Colors.border, paddingVertical: 10 },
  dayMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayCopy: { flex: 1 },
  dayDate: { color: Colors.text, fontSize: 12, fontWeight: '700' },
  dayMeta: { color: Colors.textMuted, fontSize: 10, marginTop: 4 },
  dayDetails: { marginTop: 10, gap: 4 },
  dayDetail: { color: Colors.textMuted, fontSize: 11 },
  riskCard: { marginTop: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  riskLevel0: { borderLeftWidth: 4, borderLeftColor: '#218B25' },
  riskLevel1: { borderLeftWidth: 4, borderLeftColor: '#B58A12' },
  riskLevel2: { borderLeftWidth: 4, borderLeftColor: '#D97725' },
  riskLevel3: { borderLeftWidth: 4, borderLeftColor: '#C9573F' },
  riskLevel4: { borderLeftWidth: 4, borderLeftColor: '#8E2630' },
  riskHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  riskTitle: { color: Colors.text, fontSize: 13, fontWeight: '800' },
  riskDetail: { color: Colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 7 },
  riskDisclaimer: { color: Colors.textMuted, fontSize: 9, lineHeight: 14, marginTop: 8 },
  riskUnavailable: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14, padding: 12, borderRadius: 10, backgroundColor: Colors.surface },
  googleAttribution: { color: '#5E5E5E', fontSize: 12, fontWeight: '400' },
  attribution: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', marginTop: 14 },
  source: { color: Colors.textMuted, fontSize: 10, lineHeight: 15, textAlign: 'center' },
  sourceLink: { color: Colors.secondary, fontSize: 10, lineHeight: 15, textDecorationLine: 'underline' },
});
