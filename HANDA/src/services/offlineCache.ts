import AsyncStorage from '@react-native-async-storage/async-storage';
import { authenticatedFetch } from './apiClient';

const CACHE_PREFIX = 'handa.cache.';

export async function readCachedJson<T>(path: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${path}`);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

async function writeCachedJson(path: string, value: unknown) {
  try {
    await AsyncStorage.setItem(`${CACHE_PREFIX}${path}`, JSON.stringify(value));
  } catch {
    // A full or unavailable store must never break a live response.
  }
}

export async function clearOfflineCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));
    if (cacheKeys.length) await AsyncStorage.multiRemove(cacheKeys);
  } catch {
    // Best effort cleanup on sign-out.
  }
}

/**
 * Fetches JSON from the API and keeps the last good copy on the device.
 * When the network or server is unavailable the saved copy is returned instead.
 * Authorization failures are never masked by cached data.
 */
export async function fetchJsonWithCache<T>(path: string): Promise<{ data: T; fromCache: boolean }> {
  let failure: Error;
  try {
    const response = await authenticatedFetch(path);
    if (response.ok) {
      const data = await response.json() as T;
      void writeCachedJson(path, data);
      return { data, fromCache: false };
    }
    if (response.status === 401 || response.status === 403) throw new Error(`Request failed: ${response.status}`);
    failure = new Error(`Request failed: ${response.status}`);
  } catch (error) {
    if (error instanceof Error && /Request failed: 40[13]/.test(error.message)) throw error;
    failure = error instanceof Error ? error : new Error('Network request failed');
  }
  const cached = await readCachedJson<T>(path);
  if (cached !== null) return { data: cached, fromCache: true };
  throw failure;
}
