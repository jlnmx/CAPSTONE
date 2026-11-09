import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';
import { useTheme } from '@hooks/useTheme';
import { fetchOpenMeteoForecast, OPEN_METEO_FORECAST_URL, OpenMeteoForecast } from '@services/openMeteoForecast';

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

export default function WeatherForecastScreen() {
  const { palette } = useTheme();
  const [forecast, setForecast] = useState<OpenMeteoForecast | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const loadForecast = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    try {
      const result = await fetchOpenMeteoForecast(signal);
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

  const today = forecast?.daily[0];
  const presentation = forecast?.current.presentation;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={styles.backButton}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Weather</Text>
        </View>

        {isLoading && <View style={styles.centerState}><ActivityIndicator color={Colors.primary} /><Text style={styles.stateText}>Loading weather forecast...</Text></View>}
        {!isLoading && error && (
          <View style={styles.errorCard}>
            <MaterialCommunityIcons name="alert-circle-outline" size={32} color={Colors.emergency} />
            <Text style={styles.errorTitle}>Forecast unavailable</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorText}>Source: {OPEN_METEO_FORECAST_URL}</Text>
            <Pressable onPress={() => void loadForecast()} style={styles.retryButton}><Text darkText style={styles.retryText}>Retry</Text></Pressable>
          </View>
        )}
        {!isLoading && !error && forecast && today && presentation && (
          <>
            <LinearGradient colors={presentation.gradient} style={styles.todayCard}>
              <View style={styles.todayHeading}>
                <View><Text darkText style={styles.todayLabel}>Today</Text><Text darkText style={styles.todayDate}>{displayDate(today.date, true)}</Text></View>
                <MaterialCommunityIcons name={presentation.icon} size={42} color={Colors.white} />
              </View>
              <View style={styles.todayTemperatureRow}>
                <Text darkText style={styles.todayTemperature}>{formatTemperature(forecast.current.temperature)}</Text>
                <Text darkText style={styles.todayCondition}>{presentation.description}</Text>
              </View>
              <Text darkText style={styles.todayMeta}>Feels like {formatTemperature(forecast.current.feelsLike)}  ·  High {formatTemperature(today.maxTemperature)}  ·  Low {formatTemperature(today.minTemperature)}</Text>
              <Text darkText style={styles.todayMeta}>Humidity {Math.round(forecast.current.humidity)}%  ·  Wind {Math.round(forecast.current.windSpeed)} km/h</Text>
            </LinearGradient>

            <View style={styles.hourlyCard}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourlyContent}>
                {forecast.hourly.map((hour) => (
                  <View key={hour.time} style={styles.hourItem}>
                    <Text style={styles.hourRain}>{hour.precipitationProbability}%</Text>
                    <Text style={styles.hourTime}>{displayHour(hour.time)}</Text>
                    <MaterialCommunityIcons name={hour.presentation.icon} size={26} color={Colors.secondary} />
                    <Text style={styles.hourTemperature}>{formatTemperature(hour.temperature)}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Next 7 days</Text>
              {forecast.daily.map((day) => {
                const expanded = expandedDate === day.date;
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
                      <MaterialCommunityIcons name={day.presentation.icon} size={28} color={Colors.secondary} />
                      <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color={Colors.textMuted} />
                    </View>
                    {expanded && (
                      <View style={styles.dayDetails}>
                        <Text style={styles.dayDetail}>{day.presentation.description}</Text>
                        <Text style={styles.dayDetail}>Chance of rain: {day.precipitationProbability}%  ·  Rainfall: {day.precipitationSum.toFixed(1)} mm</Text>
                        <Text style={styles.dayDetail}>Max wind: {Math.round(day.windSpeedMax)} km/h</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.attribution}>
              <Text style={styles.source}>Weather data by </Text>
              <Pressable onPress={() => void Linking.openURL('https://open-meteo.com/')} accessibilityRole="link"><Text style={styles.sourceLink}>Open-Meteo.com</Text></Pressable>
              <Text style={styles.source}> · </Text>
              <Pressable onPress={() => void Linking.openURL('https://open-meteo.com/en/licence')} accessibilityRole="link"><Text style={styles.sourceLink}>CC BY 4.0</Text></Pressable>
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
  attribution: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', marginTop: 14 },
  source: { color: Colors.textMuted, fontSize: 10, lineHeight: 15, textAlign: 'center' },
  sourceLink: { color: Colors.secondary, fontSize: 10, lineHeight: 15, textDecorationLine: 'underline' },
});
