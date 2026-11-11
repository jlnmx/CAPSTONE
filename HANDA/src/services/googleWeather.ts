import { authenticatedFetch } from '@services/apiClient';
import type { GoogleWeatherSnapshot } from '@/types/weather';

export async function fetchGoogleWeatherForecast(signal?: AbortSignal): Promise<GoogleWeatherSnapshot> {
  const response = await authenticatedFetch('/api/v1/weather', { signal });
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const detail = payload && typeof payload === 'object' && 'detail' in payload && typeof payload.detail === 'string'
      ? payload.detail
      : `Weather service request failed (${response.status}).`;
    throw new Error(detail);
  }
  if (!payload || typeof payload !== 'object' || !('current' in payload) || !('hourly' in payload) || !('daily' in payload)) {
    throw new Error('Weather service returned an invalid forecast.');
  }
  return payload as GoogleWeatherSnapshot;
}
