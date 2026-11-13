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
const unauthorizedListeners = new Set<() => void>();
let unauthorizedHandled = false;

export function subscribeToUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

async function webStorageGet() {
  return typeof globalThis.sessionStorage === 'undefined' ? null : globalThis.sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function getAccessToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return webStorageGet();
  }
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function setAccessToken(token: string): Promise<void> {
  unauthorizedHandled = false;
  if (Platform.OS === 'web') {
    globalThis.sessionStorage?.setItem(ACCESS_TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function clearAccessToken(): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.sessionStorage?.removeItem(ACCESS_TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
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
