import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL
  ?? (Platform.OS === 'web' ? 'http://localhost:8000' : `http://${expoHost ?? 'localhost'}:8000`);

const ACCESS_TOKEN_KEY = 'handa.accessToken';

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
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}
