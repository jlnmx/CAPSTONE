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
const REFRESH_TOKEN_KEY = 'handa.refreshToken';
const BIOMETRIC_REFRESH_TOKEN_KEY = 'handa.biometricRefreshToken';
const BIOMETRIC_ENABLED_KEY = 'handa.biometricLoginEnabled';
const BIOMETRIC_TOKEN_OPTIONS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  authenticationPrompt: 'Authenticate to access your HANDA sign-in credential',
};
const unauthorizedListeners = new Set<() => void>();
let unauthorizedHandled = false;
let accessTokenCache: string | null = null;
let refreshTokenCache: string | null = null;
let lastRefreshedAccessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

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
  lastRefreshedAccessToken = null;
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
  if (await isBiometricLoginEnabled()) await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  else await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  accessTokenCache = token;
}

export async function getRefreshToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return globalThis.localStorage?.getItem(REFRESH_TOKEN_KEY) ?? null;
  }
  if (refreshTokenCache) return refreshTokenCache;
  if (await isBiometricLoginEnabled()) {
    refreshTokenCache = await SecureStore.getItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY, BIOMETRIC_TOKEN_OPTIONS);
    return refreshTokenCache;
  }
  refreshTokenCache = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  return refreshTokenCache;
}

export async function setRefreshToken(token: string): Promise<void> {
  refreshTokenCache = token;
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(REFRESH_TOKEN_KEY, token);
    return;
  }
  if (await isBiometricLoginEnabled()) {
    await SecureStore.setItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY, token, BIOMETRIC_TOKEN_OPTIONS);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  } else {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  }
}

export async function clearRefreshToken(): Promise<void> {
  refreshTokenCache = null;
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(REFRESH_TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export async function isBiometricLoginEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return (await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY)) === '1';
}

export async function getBiometricAccessToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  return SecureStore.getItemAsync(BIOMETRIC_ACCESS_TOKEN_KEY, BIOMETRIC_TOKEN_OPTIONS);
}

export async function storeBiometricRefreshToken(token: string, accessToken?: string): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('Biometric sign-in is only available in the HANDA mobile app.');
  }
  await SecureStore.setItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY, token, BIOMETRIC_TOKEN_OPTIONS);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_ACCESS_TOKEN_KEY);
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, '1');
  refreshTokenCache = token;
  accessTokenCache = accessToken ?? null;
}

export async function disableBiometricAccessToken(): Promise<void> {
  if (Platform.OS === 'web') return;
  const token = refreshTokenCache ?? await SecureStore.getItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY, BIOMETRIC_TOKEN_OPTIONS);
  if (token) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  refreshTokenCache = token;
  await SecureStore.deleteItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
}

export async function clearAccessToken(preserveBiometric = false): Promise<void> {
  accessTokenCache = null;
  refreshTokenCache = null;
  lastRefreshedAccessToken = null;
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(ACCESS_TOKEN_KEY);
    globalThis.sessionStorage?.removeItem(ACCESS_TOKEN_KEY);
    globalThis.localStorage?.removeItem(REFRESH_TOKEN_KEY);
    return;
  }
  const keysToDelete = [
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ];
  if (!preserveBiometric) {
    keysToDelete.push(
      SecureStore.deleteItemAsync(BIOMETRIC_ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY),
      SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY),
    );
  }
  await Promise.all(keysToDelete);
}

export async function getBiometricRefreshToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  refreshTokenCache = await SecureStore.getItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY, BIOMETRIC_TOKEN_OPTIONS);
  if (refreshTokenCache) return refreshTokenCache;
  return getBiometricAccessToken();
}

export async function refreshAccessToken(refreshToken?: string): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const pending = requestAccessTokenRefresh(refreshToken);
  refreshPromise = pending;
  try {
    return await pending;
  } finally {
    if (refreshPromise === pending) refreshPromise = null;
  }
}

async function requestAccessTokenRefresh(refreshToken?: string): Promise<string | null> {
  const token = refreshToken ?? await getRefreshToken();
  if (!token) return null;
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: token }),
  });
  if (response.status === 401 || response.status === 403) {
    await clearAccessToken();
    unauthorizedHandled = true;
    unauthorizedListeners.forEach((listener) => listener());
    return null;
  }
  if (!response.ok) throw new Error(`Session refresh failed with status ${response.status}.`);
  const result = await response.json() as { accessToken?: string };
  if (!result.accessToken) throw new Error('Session refresh did not return an access token.');
  await setAccessToken(result.accessToken);
  lastRefreshedAccessToken = result.accessToken;
  return result.accessToken;
}

export async function createPersistentRefreshToken(accessToken?: string): Promise<string> {
  const token = accessToken ?? await getAccessToken();
  if (!token) throw new Error('Sign in before enabling persistent sign-in.');
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/remember`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('HANDA could not save a persistent sign-in credential. Please try again.');
  const result = await response.json() as { refreshToken?: string };
  if (!result.refreshToken) throw new Error('Persistent sign-in setup did not return a secure credential.');
  return result.refreshToken;
}

export async function authenticatedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (response.status !== 401 || !token || unauthorizedHandled) return response;

  const currentToken = await getAccessToken();
  if (token !== currentToken) {
    if (!currentToken || currentToken !== lastRefreshedAccessToken) return response;
    const retryHeaders = new Headers(init.headers);
    retryHeaders.set('Authorization', `Bearer ${currentToken}`);
    return fetch(`${API_BASE_URL}${path}`, { ...init, headers: retryHeaders });
  }

  const refreshedToken = await refreshAccessToken();
  if (!refreshedToken) {
    if (!unauthorizedHandled) {
      unauthorizedHandled = true;
      await clearAccessToken();
      unauthorizedListeners.forEach((listener) => listener());
    }
    return response;
  }
  const retryHeaders = new Headers(init.headers);
  retryHeaders.set('Authorization', `Bearer ${refreshedToken}`);
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers: retryHeaders });
}
