import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
const DEFAULT_NATIVE_API_URL = 'https://handa-api.onrender.com';

export const API_BASE_URL = configuredApiUrl
  || (Platform.OS === 'web' ? 'http://localhost:8000' : DEFAULT_NATIVE_API_URL);

// Render's free tier sleeps when idle and needs up to ~60s to wake, and mobile/public networks add latency.
export const SLOW_NETWORK_TIMEOUT_MS = 60000;

const SERVER_READY_TIMEOUT_MS = 90000;
const READY_CHECK_TIMEOUT_MS = 12000;
const READY_RETRY_DELAY_MS = 2000;
let serverReadyPromise: Promise<void> | null = null;

export class ApiReadinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiReadinessError';
  }
}

async function waitForServerReady(): Promise<void> {
  const deadline = Date.now() + SERVER_READY_TIMEOUT_MS;
  let lastNetworkError: unknown;

  while (Date.now() < deadline) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), READY_CHECK_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE_URL}/health/ready`, { signal: controller.signal });
      if (response.ok) return;
      if (response.status < 500 && response.status !== 408) {
        throw new ApiReadinessError(`HANDA server readiness check returned ${response.status}.`);
      }
    } catch (error) {
      if (error instanceof ApiReadinessError) throw error;
      lastNetworkError = error;
    } finally {
      clearTimeout(timer);
    }

    await new Promise((resolve) => setTimeout(resolve, READY_RETRY_DELAY_MS));
  }

  const reason = lastNetworkError instanceof Error ? ` ${lastNetworkError.message}` : '';
  throw new ApiReadinessError(`The HANDA server did not become ready in time.${reason} Please try again.`);
}

export function warmUpServer(): Promise<void> {
  if (serverReadyPromise) return serverReadyPromise;

  const pending = waitForServerReady().finally(() => {
    if (serverReadyPromise === pending) serverReadyPromise = null;
  });
  serverReadyPromise = pending;
  return pending;
}

export async function fetchWithRetry(url: string, init: RequestInit, timeoutMs = SLOW_NETWORK_TIMEOUT_MS, attempts = 2): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw lastError;
}

const ACCESS_TOKEN_KEY = 'handa.accessToken';
const BIOMETRIC_ACCESS_TOKEN_KEY = 'handa.biometricAccessToken';
const BIOMETRIC_ENABLED_KEY = 'handa.biometricLoginEnabled';
const BIOMETRIC_ACCESS_TOKEN_OPTIONS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  authenticationPrompt: 'Authenticate to sign in to HANDA',
};
const unauthorizedListeners = new Set<() => void>();
let unauthorizedHandled = false;
let accessTokenCache: string | null = null;

export function subscribeToUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

async function webStorageGet() {
  if (typeof globalThis.localStorage !== 'undefined') {
    const persistentToken = globalThis.localStorage.getItem(ACCESS_TOKEN_KEY);
    if (persistentToken) return persistentToken;
  }
  return typeof globalThis.sessionStorage === 'undefined' ? null : globalThis.sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function getAccessToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return webStorageGet();
  }
  if (accessTokenCache) return accessTokenCache;
  accessTokenCache = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  return accessTokenCache;
}

export async function setAccessToken(token: string, keepLoggedIn = true): Promise<void> {
  unauthorizedHandled = false;
  if (Platform.OS === 'web') {
    if (keepLoggedIn) {
      globalThis.localStorage?.setItem(ACCESS_TOKEN_KEY, token);
      globalThis.sessionStorage?.removeItem(ACCESS_TOKEN_KEY);
    } else {
      globalThis.sessionStorage?.setItem(ACCESS_TOKEN_KEY, token);
      globalThis.localStorage?.removeItem(ACCESS_TOKEN_KEY);
    }
    return;
  }
  if (await isBiometricLoginEnabled()) {
    await SecureStore.setItemAsync(BIOMETRIC_ACCESS_TOKEN_KEY, token, BIOMETRIC_ACCESS_TOKEN_OPTIONS);
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  } else {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  }
  accessTokenCache = token;
}

export async function isBiometricLoginEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return (await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY)) === '1';
}

export async function getBiometricAccessToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  accessTokenCache = await SecureStore.getItemAsync(BIOMETRIC_ACCESS_TOKEN_KEY, BIOMETRIC_ACCESS_TOKEN_OPTIONS);
  return accessTokenCache;
}

export async function storeBiometricAccessToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('Biometric sign-in is only available in the HANDA mobile app.');
  }
  await SecureStore.setItemAsync(BIOMETRIC_ACCESS_TOKEN_KEY, token, BIOMETRIC_ACCESS_TOKEN_OPTIONS);
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, '1');
  accessTokenCache = token;
}

export async function disableBiometricAccessToken(): Promise<void> {
  if (Platform.OS === 'web') return;
  const token = accessTokenCache ?? await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (token) await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  await SecureStore.deleteItemAsync(BIOMETRIC_ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
  accessTokenCache = token;
}

export async function clearAccessToken(): Promise<void> {
  accessTokenCache = null;
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(ACCESS_TOKEN_KEY);
    globalThis.sessionStorage?.removeItem(ACCESS_TOKEN_KEY);
    return;
  }
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(BIOMETRIC_ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY),
  ]);
}

export async function authenticatedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (response.status === 401 && token && token === await getAccessToken() && !unauthorizedHandled) {
    unauthorizedHandled = true;
    await clearAccessToken();
    unauthorizedListeners.forEach((listener) => listener());
  }
  return response;
}
