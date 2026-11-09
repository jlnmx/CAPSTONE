import type { ComponentProps } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getWeatherPresentation } from '@utils/weatherPresentation';

export type PagasaForecastDay = {
  date: string;
  condition: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  minTemperature: number | null;
  maxTemperature: number | null;
  rainfall: string;
  wind: string;
};

export const PAGASA_TEN_DAY_FORECAST_URL = process.env.EXPO_PUBLIC_PAGASA_TEN_DAY_FORECAST_API_URL?.trim() ?? '';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === 'object' ? value as UnknownRecord : {};
}

function asNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstValue(record: UnknownRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function dateLabel(value: unknown): string {
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value ?? 'Unknown date') : parsed.toISOString().slice(0, 10);
}

function iconForCondition(condition: string): PagasaForecastDay['icon'] {
  const normalized = condition.toLowerCase();
  if (normalized.includes('thunder')) return 'weather-lightning-rainy';
  if (normalized.includes('rain') || normalized.includes('shower')) return 'weather-partly-rainy';
  if (normalized.includes('cloud')) return 'weather-partly-cloudy';
  return 'weather-sunny';
}

function normalizeDay(value: unknown): PagasaForecastDay | null {
  const source = asRecord(value);
  const temperature = asRecord(firstValue(source, ['temperature', 'temp']));
  const condition = String(firstValue(source, ['condition', 'cloud_cover', 'cloudCover', 'description']) ?? 'No condition reported');
  const date = firstValue(source, ['date', 'forecast_date', 'forecastDate', 'valid_date']);
  if (!date) return null;

  const maxTemperature = asNumber(firstValue(source, ['max_temperature', 'temperature_max', 'temperature_maximum', 'maxTemp']))
    ?? asNumber(temperature.max);
  const minTemperature = asNumber(firstValue(source, ['min_temperature', 'temperature_min', 'temperature_minimum', 'minTemp']))
    ?? asNumber(temperature.min);

  return {
    date: dateLabel(date),
    condition,
    icon: iconForCondition(condition),
    minTemperature,
    maxTemperature,
    rainfall: String(firstValue(source, ['rainfall', 'rainfall_amount', 'precipitation']) ?? 'Not reported'),
    wind: String(firstValue(source, ['wind', 'wind_speed', 'windSpeed']) ?? 'Not reported'),
  };
}

export async function fetchPagasaTenDayForecast(): Promise<PagasaForecastDay[]> {
  if (!PAGASA_TEN_DAY_FORECAST_URL) {
    throw new Error('PAGASA Ten-Day Forecast API URL is not configured.');
  }

  const response = await fetch(PAGASA_TEN_DAY_FORECAST_URL);
  if (!response.ok) throw new Error(`PAGASA forecast request failed (${response.status}).`);

  const payload = await response.json() as unknown;
  const root = asRecord(payload);
  const candidates = Array.isArray(payload)
    ? payload
    : (Array.isArray(root.forecasts) ? root.forecasts : Array.isArray(root.data) ? root.data : []);
  const days = candidates.map(normalizeDay).filter((day): day is PagasaForecastDay => day !== null);
  if (days.length === 0) throw new Error('PAGASA returned no ten-day forecast records.');
  return days.slice(0, 10);
}

export function getPagasaCurrentPresentation(day: PagasaForecastDay) {
  const code = day.condition.toLowerCase().includes('thunder') ? 95
    : day.condition.toLowerCase().includes('rain') ? 61
      : day.condition.toLowerCase().includes('cloud') ? 2 : 0;
  return getWeatherPresentation(code, day.maxTemperature ?? 29, true);
}
