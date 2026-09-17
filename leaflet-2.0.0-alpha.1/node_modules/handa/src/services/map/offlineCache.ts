import * as FileSystem from 'expo-file-system';

const CACHE_DIR = `${FileSystem.documentDirectory}agap-cache/`;

export async function ensureCacheDir(): Promise<void> {
  const dir = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!dir.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

export async function saveJsonToCache<T>(fileName: string, payload: T): Promise<void> {
  await ensureCacheDir();
  const path = `${CACHE_DIR}${fileName}.json`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(payload), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function readJsonFromCache<T>(fileName: string): Promise<T | null> {
  const path = `${CACHE_DIR}${fileName}.json`;
  const info = await FileSystem.getInfoAsync(path);

  if (!info.exists) {
    return null;
  }

  const raw = await FileSystem.readAsStringAsync(path);
  return JSON.parse(raw) as T;
}

export async function hasNetworkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const response = await fetch('https://demotiles.maplibre.org', {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return response.ok;
  } catch (error) {
    return false;
  }
}

export async function cacheEmergencyLayers(data: {
  sos: unknown;
  route: unknown;
  centers: unknown;
}): Promise<void> {
  await saveJsonToCache('agap-emergency-layers', data);
}

export async function readEmergencyLayers(): Promise<{
  sos: unknown;
  route: unknown;
  centers: unknown;
} | null> {
  return readJsonFromCache('agap-emergency-layers');
}
