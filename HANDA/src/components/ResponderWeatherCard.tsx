import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors } from '@constants/colors';
import { getTimeOfDayPresentation } from '@utils/weatherTime';

const DEFAULT_LOCATION = { latitude: 14.3036, longitude: 121.0781 };
const WEATHER_DEFAULT = { temperature: 29, feelsLike: 32, humidity: 78, windSpeed: 8, weatherCode: 61, isDay: true };

type WeatherSnapshot = typeof WEATHER_DEFAULT;

function getWeatherPresentation(code: number, isDay: boolean) {
  if (code >= 95) return { description: 'Thunderstorms', icon: 'weather-lightning-rainy' as const, tip: 'Stay indoors during lightning. Keep your emergency bag and phone charged.', accent: '#D63F43' };
  if (code >= 80) return { description: 'Rain showers', icon: 'weather-pouring' as const, tip: 'Bring a rain jacket and watch for slippery roads and rising water.', accent: '#2873A8' };
  if (code >= 61) return { description: 'Light rain', icon: 'weather-rainy' as const, tip: 'Check nearby incidents and changing water levels before travelling.', accent: '#2873A8' };
  if (code >= 51) return { description: 'Drizzle', icon: 'weather-partly-rainy' as const, tip: 'Visibility may be reduced. Use caution while travelling to incidents.', accent: '#2873A8' };
  if (code === 45 || code === 48) return { description: 'Foggy', icon: 'weather-fog' as const, tip: 'Take care on the road. Use lights and allow extra travel time.', accent: '#687D8A' };
  if (code >= 2) return { description: isDay ? 'Partly cloudy' : 'Cloudy night', icon: 'weather-partly-cloudy' as const, tip: 'Conditions are calm. Continue monitoring active incidents and official alerts.', accent: '#D98C18' };
  return { description: isDay ? 'Clear skies' : 'Clear night', icon: isDay ? 'weather-sunny' as const : 'weather-night' as const, tip: 'Visibility is good. Keep response equipment and emergency contacts ready.', accent: '#D98C18' };
}

export default function ResponderWeatherCard() {
  const [weather, setWeather] = useState<WeatherSnapshot>(WEATHER_DEFAULT);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadWeather = async () => {
      try {
        let location = DEFAULT_LOCATION;
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
        if (!mounted) return;
        setWeather({
          temperature: result.current.temperature_2m,
          feelsLike: result.current.apparent_temperature,
          humidity: result.current.relative_humidity_2m,
          windSpeed: result.current.wind_speed_10m,
          weatherCode: result.current.weather_code,
          isDay: result.current.is_day === 1,
        });
        setIsUnavailable(false);
      } catch {
        if (mounted) setIsUnavailable(true);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    void loadWeather();
    const interval = setInterval(() => void loadWeather(), 10 * 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const presentation = getWeatherPresentation(weather.weatherCode, weather.isDay);
  const timePresentation = getTimeOfDayPresentation(now);

  return (
    <>
      <View style={[styles.weatherCard, { backgroundColor: timePresentation.background }]}>
        <View style={styles.weatherCardTop}><View><Text style={styles.weatherEyebrow}>LIVE CONDITIONS · {timePresentation.label.toUpperCase()}</Text><Text style={styles.weatherLocation}>Biñan City forecast</Text></View><MaterialCommunityIcons name={presentation.icon} size={30} color={Colors.white} /></View>
        {isLoading ? <ActivityIndicator color={Colors.white} /> : <>
          <View style={styles.weatherMain}><Text style={styles.temperature}>{Math.round(weather.temperature)}° C</Text><Text style={styles.weatherDescription}>{presentation.description}</Text></View>
          <Text style={styles.weatherMeta}>Feels like {Math.round(weather.feelsLike)}°  |  Humidity {weather.humidity}%  |  Wind {Math.round(weather.windSpeed)} km/h</Text>
        </>}
        {isUnavailable && <Text style={styles.weatherMeta}>Showing the latest local estimate for Biñan City.</Text>}
      </View>
      <View style={[styles.tipCard, { borderLeftColor: presentation.accent }]}><MaterialCommunityIcons name="information-outline" size={20} color={presentation.accent} /><View style={styles.tipCopy}><Text style={styles.tipTitle}>Weather safety advisory</Text><Text style={styles.tipText}>{presentation.tip}</Text></View></View>
    </>
  );
}

const styles = StyleSheet.create({
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
});
