import { useEffect, useState } from 'react';
import { getWeatherPresentation, WeatherPresentation } from '@utils/weatherPresentation';

export const BINAN_WEATHER_LOCATION = { latitude: 14.3036, longitude: 121.0781 };
export type WeatherSnapshot = { temperature: number; feelsLike: number; humidity: number; windSpeed: number; weatherCode: number; isDay: boolean };
export type WeatherEventType = 'thunderstorms' | 'heavy-rain' | 'rain' | 'rain-chance' | 'strong-winds' | 'high-heat';
export type WeatherEvent = { id: string; type: WeatherEventType; title: string; window: string; detail: string };
const WEATHER_DEFAULT: WeatherSnapshot = { temperature: 29, feelsLike: 32, humidity: 78, windSpeed: 8, weatherCode: 61, isDay: true };

type HourlyForecast = {
  time: string[];
  temperature_2m: number[];
  precipitation_probability: number[];
  precipitation: number[];
  weather_code: number[];
  wind_speed_10m: number[];
  wind_gusts_10m: number[];
};

function formatForecastTime(value: string): string {
  const hour = Number(value.slice(11, 13));
  const minute = value.slice(14, 16);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function formatForecastDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

function formatForecastWindow(start: string, end: string): string {
  const startDate = formatForecastDate(start);
  const endDate = formatForecastDate(end);
  const startTime = formatForecastTime(start);
  const endTime = formatForecastTime(end);
  return start.slice(0, 10) === end.slice(0, 10)
    ? `${startDate}, ${startTime} to ${endTime}`
    : `${startDate}, ${startTime} to ${endDate}, ${endTime}`;
}

function buildWeatherEvents(hourly: HourlyForecast | undefined): WeatherEvent[] {
  if (!hourly?.time?.length) return [];
  const isRainCode = (index: number) => [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(hourly.weather_code[index] ?? -1);
  const isThunderstormCode = (index: number) => [95, 96, 99].includes(hourly.weather_code[index] ?? -1);
  const maximum = (values: number[], start: number, end: number) => Math.max(0, ...values.slice(start, end + 1));
  const hazards: { type: WeatherEventType; title: string; matches: (index: number) => boolean; detail: (start: number, end: number) => string }[] = [
    { type: 'thunderstorms', title: 'Thunderstorms', matches: isThunderstormCode, detail: () => 'Lightning may occur. Stay indoors and avoid exposed areas.' },
    { type: 'heavy-rain', title: 'Heavy rain', matches: (index) => (hourly.precipitation[index] ?? 0) >= 7.5, detail: (start, end) => `Hourly rainfall may reach ${maximum(hourly.precipitation, start, end).toFixed(1)} mm. Watch for localized flooding.` },
    { type: 'rain', title: 'Rain', matches: (index) => isRainCode(index) && (hourly.precipitation[index] ?? 0) < 7.5, detail: (start, end) => `Rain is forecast; hourly precipitation chance peaks at ${maximum(hourly.precipitation_probability, start, end)}%.` },
    { type: 'rain-chance', title: 'Rain chance', matches: (index) => !isRainCode(index) && !isThunderstormCode(index) && (hourly.precipitation[index] ?? 0) < 7.5 && (hourly.precipitation_probability[index] ?? 0) >= 50, detail: (start, end) => `Precipitation chance reaches ${maximum(hourly.precipitation_probability, start, end)}% in this period.` },
    { type: 'strong-winds', title: 'Strong winds', matches: (index) => (hourly.wind_gusts_10m[index] ?? 0) >= 50 || (hourly.wind_speed_10m[index] ?? 0) >= 40, detail: (start, end) => `Forecast wind gusts may reach ${maximum(hourly.wind_gusts_10m, start, end)} km/h. Secure loose outdoor items.` },
    { type: 'high-heat', title: 'High heat', matches: (index) => (hourly.temperature_2m[index] ?? 0) >= 35, detail: (start, end) => `Temperature may reach ${maximum(hourly.temperature_2m, start, end)}°C. Limit midday exposure and stay hydrated.` },
  ];
  const events: { event: WeatherEvent; start: string }[] = [];

  hazards.forEach((hazard) => {
    let start = -1;
    const addEvent = (end: number) => {
      if (start < 0) return;
      const lastHour = Math.min(end, hourly.time.length - 1);
      events.push({
        start: hourly.time[start],
        event: {
          id: `${hazard.type}-${start}`,
          type: hazard.type,
          title: hazard.title,
          window: formatForecastWindow(hourly.time[start], hourly.time[lastHour]),
          detail: hazard.detail(start, lastHour),
        },
      });
      start = -1;
    };

    for (let index = 0; index < hourly.time.length; index += 1) {
      if (hazard.matches(index)) {
        if (start < 0) start = index;
      } else {
        addEvent(index - 1);
      }
    }
    addEvent(hourly.time.length - 1);
  });

  return events.sort((left, right) => left.start.localeCompare(right.start)).map(({ event }) => event);
}

export function useWeather() {
  const [weather, setWeather] = useState<WeatherSnapshot>(WEATHER_DEFAULT);
  const [weatherEvents, setWeatherEvents] = useState<WeatherEvent[]>([]);
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
        const query = new URLSearchParams({ latitude: String(BINAN_WEATHER_LOCATION.latitude), longitude: String(BINAN_WEATHER_LOCATION.longitude), current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day', hourly: 'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m', forecast_hours: '24', timezone: 'auto' });
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query.toString()}`);
        if (!response.ok) throw new Error('Weather request failed');
        const result = await response.json() as { current?: Record<string, number>; hourly?: HourlyForecast };
        if (!result.current) throw new Error('Weather data was empty');
        if (!mounted) return;
        setWeather({ temperature: result.current.temperature_2m, feelsLike: result.current.apparent_temperature, humidity: result.current.relative_humidity_2m, windSpeed: result.current.wind_speed_10m, weatherCode: result.current.weather_code, isDay: result.current.is_day === 1 });
        setWeatherEvents(buildWeatherEvents(result.hourly));
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
  return { weather, weatherEvents, presentation, isLoading, isUnavailable, now };
}