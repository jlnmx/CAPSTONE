import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  clearAccessToken,
  getAccessToken,
  getBiometricRefreshToken,
  authenticatedFetch,
  setAccessToken,
  setRefreshToken,
  storeBiometricRefreshToken,
} from '../apiClient';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const originalPlatform = Platform.OS;

describe('biometric refresh-token storage', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    jest.clearAllMocks();
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    jest.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);
    jest.mocked(SecureStore.deleteItemAsync).mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await clearAccessToken();
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  it('stores the refresh credential with OS authentication before enabling biometrics', async () => {
    await storeBiometricRefreshToken('persistent-refresh-token', 'session-token');

    expect(SecureStore.setItemAsync).toHaveBeenNthCalledWith(
      1,
      'handa.biometricRefreshToken',
      'persistent-refresh-token',
      expect.objectContaining({ requireAuthentication: true }),
    );
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('handa.accessToken');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('handa.biometricLoginEnabled', '1');
  });

  it('requires OS authentication to retrieve the biometric refresh credential', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('persistent-refresh-token');

    await expect(getBiometricRefreshToken()).resolves.toBe('persistent-refresh-token');
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
      'handa.biometricRefreshToken',
      expect.objectContaining({ requireAuthentication: true }),
    );
  });

  it('keeps active access tokens in memory rather than plain secure storage while biometrics are enabled', async () => {
    jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => (
      key === 'handa.biometricLoginEnabled' ? '1' : null
    ));

    await setAccessToken('new-session-token');

    expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith('handa.accessToken', 'new-session-token');
    await expect(getAccessToken()).resolves.toBe('new-session-token');
  });

  it('stores refresh-token updates under biometric protection when enrolled', async () => {
    jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => (
      key === 'handa.biometricLoginEnabled' ? '1' : null
    ));

    await setRefreshToken('new-refresh-token');

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'handa.biometricRefreshToken',
      'new-refresh-token',
      expect.objectContaining({ requireAuthentication: true }),
    );
    expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith('handa.refreshToken', 'new-refresh-token');
  });

  it('clears only the active session while preserving enrolled biometric credentials on sign-out', async () => {
    await clearAccessToken(true);

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('handa.accessToken');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('handa.refreshToken');
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith('handa.biometricRefreshToken');
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith('handa.biometricLoginEnabled');
  });

  it('clears remembered biometric credentials when a session is rejected', async () => {
    await clearAccessToken();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('handa.accessToken');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('handa.refreshToken');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('handa.biometricRefreshToken');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('handa.biometricLoginEnabled');
  });

  it('renews an expired access token and retries the original request', async () => {
    await setRefreshToken('persistent-refresh-token');
    await setAccessToken('expired-access-token');
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input).endsWith('/api/v1/auth/refresh')) {
        return { ok: true, status: 200, json: async () => ({ accessToken: 'renewed-access-token' }) } as Response;
      }
      if (String(input).endsWith('/api/v1/protected')) {
        const headerValue = new Headers(init?.headers).get('Authorization');
        return headerValue === 'Bearer renewed-access-token'
          ? { ok: true, status: 200 } as Response
          : { ok: false, status: 401 } as Response;
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    });

    const response = await authenticatedFetch('/api/v1/protected');

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    fetchMock.mockRestore();
  });
});
