import React from 'react';
import { WeatherWidget } from '@components/WeatherWidget';
import { useWeather } from '@hooks/useWeather';

export default function ResponderWeatherCard({ disasterActive = false }: { disasterActive?: boolean }) {
  const weather = useWeather();
  return <WeatherWidget {...weather} time={weather.now} disasterActive={disasterActive} />;
}
