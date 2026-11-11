import { useEffect, useState } from 'react';
import { fetchGoogleWeatherForecast } from '@services/googleWeather';
import type { EnvironmentalRisk, WeatherCurrent, WeatherHour } from '@/types/weather';
import { getWeatherPresentation, WeatherPresentation } from '@utils/weatherPresentation';

export type WeatherSnapshot = WeatherCurrent;
export type WeatherEventType = 'thunderstorms' | 'heavy-rain' | 'rain' | 'rain-chance' | 'strong-winds' | 'high-heat';
export type WeatherEvent = { id: string; type: WeatherEventType; title: string; window: string; detail: string };
const WEATHER_DEFAULT: WeatherSnapshot = {
  time: '',
  temperature: 29,
  feelsLike: 32,
  humidity: 78,
  windSpeed: 8,
  conditionType: 'CLOUDY',
  conditionDescription: 'Forecast unavailable',
  isDay: true,
};

function formatForecastTime(value: string): string {
  const hour = Number(value.slice(11, 13));
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:00 ${suffix}`;
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

function buildWeatherEvents(hourly: WeatherHour[]) {
  if (!hourly.length) return [];
  const isRain = (hour: WeatherHour) => /RAIN|SHOWERS/.test(hour.conditionType);
  const isThunderstorm = (hour: WeatherHour) => /THUNDER|HAIL/.test(hour.conditionType) || (hour.thunderstormProbability ?? 0) >= 50;
  const maximum = (values: Array<number | null>, start: number, end: number) => Math.max(0, ...values.slice(start, end + 1).map((value) => value ?? 0));
  const hazards: { type: WeatherEventType; title: string; matches: (hour: WeatherHour) => boolean; detail: (start: number, end: number) => string }[] = [
    { type: 'thunderstorms', title: 'Thunderstorms', matches: isThunderstorm, detail: () => 'Lightning may occur. Stay indoors and avoid exposed areas.' },
    { type: 'heavy-rain', title: 'Heavy rain', matches: (hour) => /HEAVY/.test(hour.conditionType) && isRain(hour) || (hour.precipitation ?? 0) >= 7.5, detail: (start, end) => `Hourly rainfall may reach ${maximum(hourly.map((hour) => hour.precipitation), start, end).toFixed(1)} mm. Watch for localized flooding.` },
    { type: 'rain', title: 'Rain', matches: (hour) => isRain(hour) && (hour.precipitation ?? 0) < 7.5 && !/HEAVY/.test(hour.conditionType), detail: (start, end) => `Rain is forecast; hourly precipitation chance peaks at ${maximum(hourly.map((hour) => hour.precipitationProbability), start, end)}%.` },
    { type: 'rain-chance', title: 'Rain chance', matches: (hour) => !isRain(hour) && !isThunderstorm(hour) && (hour.precipitationProbability ?? 0) >= 50, detail: (start, end) => `Precipitation chance reaches ${maximum(hourly.map((hour) => hour.precipitationProbability), start, end)}% in this period.` },
    { type: 'strong-winds', title: 'Strong winds', matches: (hour) => (hour.windGust ?? 0) >= 50 || (hour.windSpeed ?? 0) >= 40 || hour.conditionType === 'WINDY', detail: (start, end) => `Forecast wind gusts may reach ${maximum(hourly.map((hour) => hour.windGust), start, end)} km/h. Secure loose outdoor items.` },
    { type: 'high-heat', title: 'High heat', matches: (hour) => hour.temperature >= 35, detail: (start, end) => `Temperature may reach ${maximum(hourly.map((hour) => hour.temperature), start, end)}°C. Limit midday exposure and stay hydrated.` },
  ];
  const events: { event: WeatherEvent; start: string }[] = [];

  hazards.forEach((hazard) => {
    let start = -1;
    const addEvent = (end: number) => {
      if (start < 0) return;
      const lastHour = Math.min(end, hourly.length - 1);
      events.push({
        start: hourly[start].time,
        event: {
          id: `${hazard.type}-${start}`,
          type: hazard.type,
          title: hazard.title,
          window: formatForecastWindow(hourly[start].time, hourly[lastHour].time),
          detail: hazard.detail(start, lastHour),
        },
      });
      start = -1;
    };

    for (let index = 0; index < hourly.length; index += 1) {
      if (hazard.matches(hourly[index])) {
        if (start < 0) start = index;
      } else {
        addEvent(index - 1);
      }
    }
    addEvent(hourly.length - 1);
  });

  return events.sort((left, right) => left.start.localeCompare(right.start)).map(({ event }) => event);
}

export function useWeather() {
  const [forecast, setForecast] = useState<Awaited<ReturnType<typeof fetchGoogleWeatherForecast>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const loadWeather = async () => {
      try {
        const result = await fetchGoogleWeatherForecast(controller.signal);
        if (!mounted) return;
        setForecast(result);
        setIsUnavailable(false);
        setErrorMessage(null);
      } catch (error) {
        if (mounted) {
          setIsUnavailable(true);
          setErrorMessage(error instanceof Error ? error.message : 'Weather service is unavailable.');
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    void loadWeather();
    const refresh = setInterval(() => void loadWeather(), 15 * 60 * 1000);
    return () => {
      mounted = false;
      controller.abort();
      clearInterval(refresh);
    };
  }, []);

  const weather = forecast?.current ?? WEATHER_DEFAULT;
  const weatherEvents = forecast ? buildWeatherEvents(forecast.hourly) : [];
  const presentation: WeatherPresentation = getWeatherPresentation(weather.conditionType, weather.temperature, weather.isDay, weather.conditionDescription);
  const environmentalRisk: EnvironmentalRisk | null = forecast?.environmentalRisk ?? null;
  return {
    weather,
    weatherEvents,
    environmentalRisk,
    airQualityUnavailable: Boolean(forecast && !forecast.airQualityAvailable),
    presentation,
    isLoading,
    isUnavailable,
    errorMessage,
    now,
  };
}
