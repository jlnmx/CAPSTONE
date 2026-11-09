import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';
import { useTheme } from '@hooks/useTheme';
import { fetchPagasaTenDayForecast, getPagasaCurrentPresentation, PAGASA_API_BASE_URL, PagasaForecastDay } from '@services/pagasaForecast';

function displayDate(value: string, includeYear = false): string {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', ...(includeYear ? { year: 'numeric' } : {}) }).format(date);
}

export default function WeatherForecastScreen() {
  const { palette } = useTheme();
  const [forecast, setForecast] = useState<PagasaForecastDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadForecast = async () => {
    setIsLoading(true);
    try {
      setForecast(await fetchPagasaTenDayForecast());
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load the PAGASA forecast.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadForecast();
  }, []);

  const today = forecast[0];
  const presentation = useMemo(() => today ? getPagasaCurrentPresentation(today) : null, [today]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={styles.backButton}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Weather</Text>
        </View>

        {isLoading && <View style={styles.centerState}><ActivityIndicator color={Colors.primary} /><Text style={styles.stateText}>Loading PAGASA forecast...</Text></View>}
        {!isLoading && error && (
          <View style={styles.errorCard}>
            <MaterialCommunityIcons name="alert-circle-outline" size={32} color={Colors.emergency} />
            <Text style={styles.errorTitle}>Forecast unavailable</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorText}>Source: {PAGASA_API_BASE_URL}</Text>
            <Pressable onPress={() => void loadForecast()} style={styles.retryButton}><Text darkText style={styles.retryText}>Retry</Text></Pressable>
          </View>
        )}
        {!isLoading && !error && today && presentation && (
          <>
            <LinearGradient colors={presentation.gradient} style={styles.todayCard}>
              <View style={styles.todayHeading}>
                <View><Text darkText style={styles.todayLabel}>Today</Text><Text darkText style={styles.todayDate}>{displayDate(today.date, true)}</Text></View>
                <MaterialCommunityIcons name={presentation.icon} size={42} color={Colors.white} />
              </View>
              <View style={styles.todayTemperatureRow}>
                <Text darkText style={styles.todayTemperature}>{today.maxTemperature ?? '--'}°C</Text>
                <Text darkText style={styles.todayCondition}>{today.condition}</Text>
              </View>
              <Text darkText style={styles.todayMeta}>Low {today.minTemperature ?? '--'}°C  ·  Rain {today.rainfall}  ·  Wind {today.wind}</Text>
            </LinearGradient>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Next 10 days</Text>
              {forecast.slice(1).map((day) => (
                <View key={day.date} style={styles.dayRow}>
                  <View style={styles.dayCopy}>
                    <Text style={styles.dayDate}>{displayDate(day.date)}</Text>
                    <Text style={styles.dayMeta}>{day.condition}  ·  Rain {day.rainfall}</Text>
                  </View>
                  <MaterialCommunityIcons name={day.icon} size={28} color={Colors.secondary} />
                  <Text style={styles.dayTemperature}>{day.minTemperature ?? '--'}° / {day.maxTemperature ?? '--'}°</Text>
                </View>
              ))}
            </View>
            <Text style={styles.source}>Source: PAGASA Ten-Day Forecast API. Forecasts are updated by PAGASA; check official advisories for warnings.</Text>
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
  todayMeta: { color: Colors.white, fontSize: 11, marginTop: 13 },
  section: { marginTop: 18, borderRadius: 14, backgroundColor: Colors.surface, paddingHorizontal: 14 },
  sectionTitle: { color: Colors.text, fontSize: 14, fontWeight: '800', paddingVertical: 14 },
  dayRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border, gap: 10 },
  dayCopy: { flex: 1 },
  dayDate: { color: Colors.text, fontSize: 12, fontWeight: '700' },
  dayMeta: { color: Colors.textMuted, fontSize: 10, marginTop: 4 },
  dayTemperature: { minWidth: 72, color: Colors.text, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  source: { color: Colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 14, textAlign: 'center' },
});
