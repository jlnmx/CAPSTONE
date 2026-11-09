import { BINAN_WEATHER_LOCATION } from '@hooks/useWeather';
import { getWeatherPresentation, WeatherPresentation } from '@utils/weatherPresentation';

export const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
export const FORECAST_DAYS = 7;

export type HourlyForecastItem = {
  time: string;
  temperature: number;
  weatherCode: number;
  precipitationProbability: number;
  isDay: boolean;
  presentation: WeatherPresentation;
};

export type DailyForecastItem = {
  date: string;
  weatherCode: number;
  minTemperature: number;
  maxTemperature: number;
  precipitationSum: number;
  precipitationProbability: number;
  windSpeedMax: number;
  presentation: WeatherPresentation;
};

export type CurrentForecast = {
  time: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  isDay: boolean;
  presentation: WeatherPresentation;
};

export type OpenMeteoForecast = {
  current: CurrentForecast;
  hourly: HourlyForecastItem[];
  daily: DailyForecastItem[];
};

type OpenMeteoResponse = {
  current?: Record<string, number | string>;
  hourly?: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    precipitation_probability: number[];
    is_day: number[];
  };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
    wind_speed_10m_max: number[];
  };
};

export async function fetchOpenMeteoForecast(signal?: AbortSignal): Promise<OpenMeteoForecast> {
  const query = new URLSearchParams({
    latitude: String(BINAN_WEATHER_LOCATION.latitude),
    longitude: String(BINAN_WEATHER_LOCATION.longitude),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day',
    hourly: 'temperature_2m,weather_code,precipitation_probability,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
    forecast_days: String(FORECAST_DAYS),
    timezone: 'auto',
  });
  const response = await fetch(`${OPEN_METEO_FORECAST_URL}?${query.toString()}`, { signal });
  if (!response.ok) throw new Error(`Open-Meteo request failed (${response.status}).`);
  const result = await response.json() as OpenMeteoResponse;
  const { current, hourly, daily } = result;
  if (!current || !hourly?.time?.length || !daily?.time?.length) throw new Error('Open-Meteo returned no forecast data.');

  const currentTemperature = Number(current.temperature_2m);
  const currentCode = Number(current.weather_code);
  const currentIsDay = Number(current.is_day) === 1;
  const currentTime = String(current.time);

  // Show the current hour onward; the API always starts the hourly series at 00:00 today.
  const currentHour = currentTime.slice(0, 13);
  const startIndex = Math.max(0, hourly.time.findIndex((time) => time.slice(0, 13) >= currentHour));

  return {
    current: {
      time: currentTime,
      temperature: currentTemperature,
      feelsLike: Number(current.apparent_temperature),
      humidity: Number(current.relative_humidity_2m),
      windSpeed: Number(current.wind_speed_10m),
      weatherCode: currentCode,
      isDay: currentIsDay,
      presentation: getWeatherPresentation(currentCode, currentTemperature, currentIsDay),
    },
    hourly: hourly.time.slice(startIndex, startIndex + 24).map((time, offset) => {
      const index = startIndex + offset;
      const isDay = hourly.is_day[index] === 1;
      return {
        time,
        temperature: hourly.temperature_2m[index],
        weatherCode: hourly.weather_code[index],
        precipitationProbability: hourly.precipitation_probability[index] ?? 0,
        isDay,
        presentation: getWeatherPresentation(hourly.weather_code[index], hourly.temperature_2m[index], isDay),
      };
    }),
    daily: daily.time.map((date, index) => ({
      date,
      weatherCode: daily.weather_code[index],
      minTemperature: daily.temperature_2m_min[index],
      maxTemperature: daily.temperature_2m_max[index],
      precipitationSum: daily.precipitation_sum[index] ?? 0,
      precipitationProbability: daily.precipitation_probability_max[index] ?? 0,
      windSpeedMax: daily.wind_speed_10m_max[index] ?? 0,
      presentation: getWeatherPresentation(daily.weather_code[index], daily.temperature_2m_max[index], true),
    })),
  };
}
