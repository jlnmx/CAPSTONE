import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { getWeatherPresentation, WeatherPresentation } from '@utils/weatherPresentation';

const DEFAULT_LOCATION = { latitude: 14.3036, longitude: 121.0781 };
export type WeatherSnapshot = { temperature: number; feelsLike: number; humidity: number; windSpeed: number; weatherCode: number; isDay: boolean };
const WEATHER_DEFAULT: WeatherSnapshot = { temperature: 29, feelsLike: 32, humidity: 78, windSpeed: 8, weatherCode: 61, isDay: true };

export function useWeather() {
  const [weather, setWeather] = useState<WeatherSnapshot>(WEATHER_DEFAULT);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(clock);
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
        const query = new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude), current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day', timezone: 'auto' });
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query.toString()}`);
        if (!response.ok) throw new Error('Weather request failed');
        const result = await response.json() as { current?: Record<string, number> };
        if (!result.current) throw new Error('Weather data was empty');
        if (!mounted) return;
        setWeather({ temperature: result.current.temperature_2m, feelsLike: result.current.apparent_temperature, humidity: result.current.relative_humidity_2m, windSpeed: result.current.wind_speed_10m, weatherCode: result.current.weather_code, isDay: result.current.is_day === 1 });
        setIsUnavailable(false);
      } catch {
        if (mounted) setIsUnavailable(true);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    void loadWeather();
    const refresh = setInterval(() => void loadWeather(), 10 * 60 * 1000);
    return () => { mounted = false; clearInterval(refresh); };
  }, []);

  const presentation: WeatherPresentation = getWeatherPresentation(weather.weatherCode, weather.temperature, weather.isDay);
  return { weather, presentation, isLoading, isUnavailable, now };
}