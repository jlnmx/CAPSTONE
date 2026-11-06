import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { authenticatedFetch } from './apiClient';

const TOKEN_KEY = 'handa.pushToken';
let pendingRegistration: Promise<void> | null = null;

async function updateDevice(path: string, token: string): Promise<void> {
  const response = await authenticatedFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) throw new Error(`Notification registration failed (HTTP ${response.status}).`);
}

export async function registerPushDevice(): Promise<void> {
  if (Platform.OS !== 'android' || !Device.isDevice) return;
  if (pendingRegistration) return pendingRegistration;
  pendingRegistration = (async () => {
    await Notifications.setNotificationChannelAsync('incidents', {
      name: 'Incident alerts',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) {
      const oldToken = await SecureStore.getItemAsync(TOKEN_KEY);
      if (oldToken) {
        await updateDevice('/api/v1/push-devices/remove', oldToken);
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
      return;
    }
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (typeof projectId !== 'string' || !projectId) throw new Error('The Expo project ID is missing.');
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const oldToken = await SecureStore.getItemAsync(TOKEN_KEY);
    if (oldToken && oldToken !== token) await updateDevice('/api/v1/push-devices/remove', oldToken);
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await updateDevice('/api/v1/push-devices', token);
  })();
  try {
    await pendingRegistration;
  } finally {
    pendingRegistration = null;
  }
}

export async function unregisterPushDevice(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (pendingRegistration) {
    try {
      await pendingRegistration;
    } catch (error) {
      console.error('Push registration failed before sign-out:', error);
    }
  }
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return;
  await updateDevice('/api/v1/push-devices/remove', token);
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
