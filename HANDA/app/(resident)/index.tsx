import React from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { Colors } from '@constants/colors';
import { NotificationBell } from '@components/NotificationBell';

const actions = [
  { icon: 'account-plus-outline' as const, label: 'Register Evacuee', route: '/(resident)/register-evacuee' },
  { icon: 'checkbox-marked-outline' as const, label: 'Verify Check-in', route: '/(resident)/alerts' },
  { icon: 'alert-circle-outline' as const, label: 'Report incident', route: '/(resident)/report' },
  { icon: 'home-city-outline' as const, label: 'Center status', route: '/(resident)/map' },
];

const DEFAULT_LOCATION = { latitude: 14.3036, longitude: 121.0781 };
const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL
  ?? (Platform.OS === 'web' ? 'http://localhost:8000' : `http://${expoHost ?? 'localhost'}:8000`);

type ActiveDisaster = {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'Upcoming' | 'Active' | 'Archived';
  affected_areas: number;
  started_at: string | null;
};

type WeatherSnapshot = {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  isDay: boolean;
};

type WeatherPresentation = {
  description: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  tip: string;
  accent: string;
};

const WEATHER_DEFAULT: WeatherSnapshot = {
  temperature: 29,
  feelsLike: 32,
  humidity: 78,
  windSpeed: 8,
  weatherCode: 61,
  isDay: true,
};

function getWeatherPresentation(code: number, isDay: boolean): WeatherPresentation {
  if (code >= 95) return { description: 'Thunderstorms', icon: 'weather-lightning-rainy', tip: 'Stay indoors during lightning. Keep your emergency bag and phone charged.', accent: '#D63F43' };
  if (code >= 80) return { description: 'Rain showers', icon: 'weather-pouring', tip: 'Bring a rain jacket and watch for slippery roads and rising water.', accent: '#2873A8' };
  if (code >= 61) return { description: 'Light rain', icon: 'weather-rainy', tip: 'Carry an umbrella and check the latest alerts before travelling.', accent: '#2873A8' };
  if (code >= 51) return { description: 'Drizzle', icon: 'weather-partly-rainy', tip: 'Visibility may be reduced. Leave extra space when travelling.', accent: '#2873A8' };
  if (code === 45 || code === 48) return { description: 'Foggy', icon: 'weather-fog', tip: 'Take care on the road. Use lights and avoid unnecessary travel.', accent: '#687D8A' };
  if (code >= 2) return { description: isDay ? 'Partly cloudy' : 'Cloudy night', icon: 'weather-partly-cloudy', tip: 'Conditions are calm. Keep checking alerts as weather can change quickly.', accent: '#D98C18' };
  return { description: isDay ? 'Clear skies' : 'Clear night', icon: isDay ? 'weather-sunny' : 'weather-night', tip: 'Good visibility right now. Keep your emergency contacts easy to reach.', accent: '#D98C18' };
}

function getTimeTheme(hour: number, isDay: boolean) {
  if (hour >= 5 && hour < 9) return { name: 'Dawn', background: '#F7E5C8', header: '#218B25' };
  if (hour >= 17 && hour < 20) return { name: 'Dusk', background: '#EAD5D0', header: '#218B25' };
  if (hour >= 20 || hour < 5 || !isDay) return { name: 'Evening', background: '#DCE6F0', header: '#218B25' };
  return { name: 'Afternoon', background: '#E5F0E8', header: '#218B25' };
}

export default function ResidentDashboard() {
  const [activeDisaster, setActiveDisaster] = useState<ActiveDisaster | null>(null);
  const [isDisasterLoading, setIsDisasterLoading] = useState(true);
  const [disasterError, setDisasterError] = useState(false);
  const [weather, setWeather] = useState<WeatherSnapshot>(WEATHER_DEFAULT);
  const [isWeatherLoading, setIsWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const loadActiveDisaster = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/disasters`);
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
    const loadWeather = async () => {
      let location = DEFAULT_LOCATION;
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status === 'granted') {
          const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        }

        const query = new URLSearchParams({
          latitude: String(location.latitude),
          longitude: String(location.longitude),
          current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day',
          timezone: 'auto',
        });
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query.toString()}`);
        if (!response.ok) throw new Error('Weather request failed');
        const result = await response.json() as { current?: Record<string, number> };
        if (!result.current) throw new Error('Weather data was empty');
        setWeather({
          temperature: result.current.temperature_2m,
          feelsLike: result.current.apparent_temperature,
          humidity: result.current.relative_humidity_2m,
          windSpeed: result.current.wind_speed_10m,
          weatherCode: result.current.weather_code,
          isDay: result.current.is_day === 1,
        });
      } catch {
        setWeatherError(true);
      } finally {
        setIsWeatherLoading(false);
      }
    };

    void loadWeather();
    const clock = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(clock);
  }, []);

  const presentation = getWeatherPresentation(weather.weatherCode, weather.isDay);
  const timeTheme = getTimeTheme(now.getHours(), weather.isDay);
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(now);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: timeTheme.background }]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { backgroundColor: timeTheme.header }]}>
          <View style={styles.brandRow}><Text style={styles.brand}>HANDA</Text></View>
          <NotificationBell />
        </View>

        <View style={styles.greeting}>
          <View>
            <Text style={styles.greetingTitle}>Good morning, Biñanense!</Text>
            <Text style={styles.greetingDate}>{formattedDate}</Text>
          </View>
          <View style={[styles.weatherIcon, { borderColor: presentation.accent }]}><MaterialCommunityIcons name={presentation.icon} size={26} color={presentation.accent} /></View>
        </View>

        <View style={[styles.weatherCard, { backgroundColor: presentation.accent }]}>
          <View style={styles.weatherCardTop}><View><Text style={styles.weatherEyebrow}>LIVE CONDITIONS</Text><Text style={styles.weatherLocation}>Biñan City forecast</Text></View><MaterialCommunityIcons name={presentation.icon} size={30} color={Colors.white} /></View>
          {isWeatherLoading ? <ActivityIndicator color={Colors.white} /> : <>
            <View style={styles.weatherMain}><Text style={styles.temperature}>{Math.round(weather.temperature)}° C</Text><Text style={styles.weatherDescription}>{presentation.description}</Text></View>
            <Text style={styles.weatherMeta}>Feels like {Math.round(weather.feelsLike)}°  |  Humidity {weather.humidity}%  |  Wind {Math.round(weather.windSpeed)} km/h</Text>
          </>}
          {weatherError && <Text style={styles.weatherMeta}>Showing the latest local estimate for Biñan City.</Text>}
        </View>

        <View style={[styles.tipCard, { borderLeftColor: presentation.accent }]}><MaterialCommunityIcons name="information-outline" size={20} color={presentation.accent} /><View style={styles.tipCopy}><Text style={styles.tipTitle}>{timeTheme.name} safety tip</Text><Text style={styles.tipText}>{presentation.tip}</Text></View></View>

        <Pressable style={(state) => { const { pressed, hovered } = state as typeof state & { hovered?: boolean }; return [styles.disasterCard, !activeDisaster && styles.disasterCardEmpty, hovered && styles.disasterCardHovered, pressed && styles.buttonPressed]; }} onPress={() => activeDisaster && router.push('/(resident)/alerts')} disabled={!activeDisaster}>
          <View style={styles.alertIcon}><MaterialCommunityIcons name={activeDisaster ? 'alert-outline' : 'weather-hurricane'} size={29} color={Colors.white} /></View>
          <View style={styles.disasterCopy}><Text style={styles.disasterName}>{isDisasterLoading ? 'Checking disaster status...' : activeDisaster?.name || 'No active disaster'}</Text><Text style={styles.disasterStatus}>{disasterError ? 'Live status unavailable' : activeDisaster ? 'Active Disaster' : 'Monitoring live reports'}</Text></View>
          {activeDisaster && <MaterialCommunityIcons name="chevron-right" size={30} color={Colors.white} />}
        </Pressable>

        <View style={styles.statusRow}>
          <StatusTile icon="account-outline" title="MY STATUS" detail="Checked in" />
          <StatusTile icon="account-multiple-outline" title="HOUSEHOLD" detail="4 members" />
        </View>

        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        <View style={styles.actionGrid}>{actions.map((action) => <Pressable key={action.label} style={(state) => { const { pressed, hovered } = state as typeof state & { hovered?: boolean }; return [styles.actionButton, hovered && styles.actionButtonHovered, pressed && styles.buttonPressed]; }} onPress={() => router.push(action.route)}><MaterialCommunityIcons name={action.icon} size={25} color="#218B25" /><Text style={styles.actionLabel}>{action.label}</Text></Pressable>)}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusTile({ icon, title, detail }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; title: string; detail: string }) {
  return <View style={styles.statusTile}><MaterialCommunityIcons name={icon} size={29} color="#1E5987" /><View style={styles.statusCopy}><Text style={styles.statusTitle}>{title}</Text><Text style={styles.statusDetail}>{detail}</Text></View></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.white },
  container: { flex: 1, backgroundColor: Colors.white },
  content: { paddingBottom: 22 },
  header: { height: 86, paddingHorizontal: 18, backgroundColor: '#218B25', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brand: { color: Colors.white, fontSize: 32, fontWeight: '800', letterSpacing: 1 },
  notificationButton: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  notificationDot: { position: 'absolute', top: 6, right: 5, width: 6, height: 6, borderRadius: 3, backgroundColor: '#F5D14B' },
  greeting: { minHeight: 55, paddingHorizontal: 18, paddingTop: 11, paddingBottom: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greetingTitle: { color: '#187821', fontSize: 15, fontWeight: '800' },
  greetingDate: { color: '#187821', fontSize: 9, fontWeight: '600', marginTop: 4 },
  weatherIcon: { width: 29, height: 29, borderRadius: 16, borderWidth: 2, borderColor: '#E3A02C', backgroundColor: '#FFD477', alignItems: 'center', justifyContent: 'center' },
  weatherCard: { minHeight: 112, marginHorizontal: 18, marginTop: 2, marginBottom: 9, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 8 },
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
  disasterCardEmpty: { backgroundColor: '#6B7B85' },
  disasterCardHovered: { transform: [{ translateY: -3 }], shadowColor: '#8F252A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.24, shadowRadius: 8, elevation: 6 },
  alertIcon: { width: 38, height: 38, borderWidth: 3, borderColor: Colors.white, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  disasterCopy: { flex: 1, marginLeft: 10 },
  disasterName: { color: Colors.white, fontSize: 14, fontWeight: '800' },
  disasterStatus: { color: Colors.white, fontSize: 9, marginTop: 2 },
  statusRow: { flexDirection: 'row', gap: 9, marginHorizontal: 18, marginBottom: 14 },
  statusTile: { flex: 1, minHeight: 70, paddingHorizontal: 8, borderRadius: 8, backgroundColor: '#EEF2EF', flexDirection: 'row', alignItems: 'center' },
  statusCopy: { marginLeft: 8 },
  statusTitle: { color: '#1E5987', fontSize: 10, fontWeight: '800' },
  statusDetail: { color: '#218B25', fontSize: 9, marginTop: 3 },
  sectionTitle: { color: '#218B25', fontSize: 16, fontWeight: '800', marginHorizontal: 18, marginTop: 0, marginBottom: 8 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginHorizontal: 18 },
  actionButton: { width: '48%', minHeight: 46, borderRadius: 8, backgroundColor: '#EEF2EF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: 'transparent' },
  actionButtonHovered: { transform: [{ translateY: -3 }], backgroundColor: '#FFFFFF', borderColor: '#8BC58B', shadowColor: '#1769AA', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.16, shadowRadius: 7, elevation: 5 },
  buttonPressed: { transform: [{ translateY: 1 }] },
  actionLabel: { color: '#218B25', fontSize: 9, marginLeft: 6, flexShrink: 1 },
});
