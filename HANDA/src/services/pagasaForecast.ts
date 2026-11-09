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

const configuredPagasaUrl = process.env.EXPO_PUBLIC_PAGASA_TEN_DAY_FORECAST_API_URL?.trim().replace(/\/$/, '');
export const PAGASA_API_BASE_URL = configuredPagasaUrl || 'https://tenday.pagasa.dost.gov.ph';
export const PAGASA_TEN_DAY_CURRENT_URL = `${PAGASA_API_BASE_URL}/api/v1/tenday/current`;
export const PAGASA_TEN_DAY_FULL_URL = `${PAGASA_API_BASE_URL}/api/v1/tenday/full`;
export const PAGASA_LOCATION = { municity: 'Biñan City', province: 'Laguna' };
const pagasaApiToken = process.env.EXPO_PUBLIC_PAGASA_API_TOKEN?.trim();

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
  const rainfall = asRecord(firstValue(source, ['rainfall', 'precipitation']));
  const wind = asRecord(firstValue(source, ['wind', 'wind_speed', 'windSpeed']));
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
    rainfall: String(firstValue(rainfall, ['description', 'total']) ?? firstValue(source, ['rainfall_amount', 'precipitation']) ?? 'Not reported'),
    wind: String(firstValue(wind, ['speed', 'direction']) ?? firstValue(source, ['wind_speed', 'windSpeed']) ?? 'Not reported'),
  };
}

function getForecastCandidates(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const root = asRecord(payload);
  for (const key of ['forecasts', 'forecast', 'data', 'results']) {
    const value = root[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      const nested = getForecastCandidates(value);
      if (nested.length > 0) return nested;
    }
  }
  return Object.keys(root).length > 0 ? [payload] : [];
}

function buildEndpoint(path: string): string {
  const query = new URLSearchParams(PAGASA_LOCATION);
  return `${path}?${query.toString()}`;
}

export async function fetchPagasaTenDayForecast(): Promise<PagasaForecastDay[]> {
  const headers: HeadersInit = {
    Accept: 'application/json',
    ...(pagasaApiToken ? { Authorization: `Bearer ${pagasaApiToken}`, token: pagasaApiToken } : {}),
  };
  const [currentResponse, fullResponse] = await Promise.all([
    fetch(buildEndpoint(PAGASA_TEN_DAY_CURRENT_URL), { headers }),
    fetch(buildEndpoint(PAGASA_TEN_DAY_FULL_URL), { headers }),
  ]);
  if (!currentResponse.ok) throw new Error(`PAGASA current forecast request failed (${currentResponse.status}).`);
  if (!fullResponse.ok) throw new Error(`PAGASA full forecast request failed (${fullResponse.status}).`);

  const [currentPayload, fullPayload] = await Promise.all([
    currentResponse.json() as Promise<unknown>,
    fullResponse.json() as Promise<unknown>,
  ]);
  const currentDay = getForecastCandidates(currentPayload).map(normalizeDay).find((day): day is PagasaForecastDay => day !== null);
  const fullDays = getForecastCandidates(fullPayload).map(normalizeDay).filter((day): day is PagasaForecastDay => day !== null);
  const days = currentDay && !fullDays.some((day) => day.date === currentDay.date)
    ? [currentDay, ...fullDays]
    : fullDays;
  if (days.length === 0) throw new Error('PAGASA returned no ten-day forecast records.');
  return days.slice(0, 10);
}

export function getPagasaCurrentPresentation(day: PagasaForecastDay) {
  const code = day.condition.toLowerCase().includes('thunder') ? 95
    : day.condition.toLowerCase().includes('rain') ? 61
      : day.condition.toLowerCase().includes('cloud') ? 2 : 0;
  return getWeatherPresentation(code, day.maxTemperature ?? 29, true);
}
