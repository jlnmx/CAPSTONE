import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const expoHostUri = Constants.expoConfig?.hostUri
  ?? (Constants as typeof Constants & { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost;
const expoHost = expoHostUri?.split(':')[0];
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');

export const API_BASE_URL = configuredApiUrl
  ?? (Platform.OS === 'web' ? 'http://localhost:8000' : `http://${expoHost ?? 'localhost'}:8000`);

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
