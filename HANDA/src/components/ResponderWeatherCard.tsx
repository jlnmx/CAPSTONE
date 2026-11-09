import React from 'react';
import { useRouter } from 'expo-router';
import { WeatherWidget } from '@components/WeatherWidget';
import { useWeather } from '@hooks/useWeather';

export default function ResponderWeatherCard({ disasterActive = false }: { disasterActive?: boolean }) {
  const weather = useWeather();
  const router = useRouter();
  return <WeatherWidget {...weather} time={weather.now} disasterActive={disasterActive} showForecast={false} onPress={() => router.push('/(responder)/weather')} />;
}
