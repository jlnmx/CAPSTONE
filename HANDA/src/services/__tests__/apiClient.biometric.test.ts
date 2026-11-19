import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  clearAccessToken,
  getAccessToken,
  getBiometricAccessToken,
  setAccessToken,
  storeBiometricAccessToken,
} from '../apiClient';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const originalPlatform = Platform.OS;

describe('biometric access-token storage', () => {
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

  it('stores the token with OS authentication before enabling the biometric marker', async () => {
    await storeBiometricAccessToken('session-token');

    expect(SecureStore.setItemAsync).toHaveBeenNthCalledWith(
      1,
      'handa.biometricAccessToken',
      'session-token',
      expect.objectContaining({ requireAuthentication: true }),
    );
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('handa.accessToken');
    expect(SecureStore.setItemAsync).toHaveBeenNthCalledWith(2, 'handa.biometricLoginEnabled', '1');
  });

  it('requires OS authentication to retrieve the protected token', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('session-token');

    await expect(getBiometricAccessToken()).resolves.toBe('session-token');
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
      'handa.biometricAccessToken',
      expect.objectContaining({ requireAuthentication: true }),
    );
  });

  it('updates the protected token instead of writing a plain token when enrollment is active', async () => {
    jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => (
      key === 'handa.biometricLoginEnabled' ? '1' : null
    ));

    await setAccessToken('new-session-token');

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'handa.biometricAccessToken',
      'new-session-token',
      expect.objectContaining({ requireAuthentication: true }),
    );
    expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith('handa.accessToken', 'new-session-token');
  });

  it('clears both ordinary and biometric tokens on session cleanup', async () => {
    await clearAccessToken();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('handa.accessToken');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('handa.biometricAccessToken');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('handa.biometricLoginEnabled');
  });

  it('uses the in-memory token after biometric unlock for authenticated API requests', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('session-token');
    await getBiometricAccessToken();
    jest.mocked(SecureStore.getItemAsync).mockClear();

    await expect(getAccessToken()).resolves.toBe('session-token');
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  });
});
