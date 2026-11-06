import { registerPushDevice, unregisterPushDevice } from '../pushNotifications';
import { authenticatedFetch } from '../apiClient';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { eas: { projectId: 'project-id' } } } } }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
}));
jest.mock('../apiClient', () => ({ authenticatedFetch: jest.fn() }));
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));

const fetchMock = jest.mocked(authenticatedFetch);
const storedToken = jest.mocked(SecureStore.getItemAsync);

beforeEach(() => {
  jest.clearAllMocks();
  storedToken.mockResolvedValue(null);
  fetchMock.mockResolvedValue({ ok: true } as Response);
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: false, canAskAgain: true } as Notifications.NotificationPermissionsStatus);
  jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({ granted: true } as Notifications.NotificationPermissionsStatus);
  jest.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({ type: 'expo', data: 'ExpoPushToken[abc123]' });
});

it('requests permission, creates the high-importance channel and registers the token', async () => {
  await registerPushDevice();
  expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('incidents', expect.objectContaining({ importance: 4 }));
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
  expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'project-id' });
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('handa.pushToken', 'ExpoPushToken[abc123]');
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/push-devices', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ token: 'ExpoPushToken[abc123]' }),
  }));
});

it('removes a previous token when permission is denied', async () => {
  storedToken.mockResolvedValue('ExpoPushToken[old123]');
  jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({ granted: false } as Notifications.NotificationPermissionsStatus);
  await registerPushDevice();
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/push-devices/remove', expect.anything());
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('handa.pushToken');
  expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
});

it('keeps the saved token if removal fails during sign-out', async () => {
  storedToken.mockResolvedValue('ExpoPushToken[abc123]');
  fetchMock.mockResolvedValue({ ok: false, status: 503 } as Response);
  await expect(unregisterPushDevice()).rejects.toThrow('HTTP 503');
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});
