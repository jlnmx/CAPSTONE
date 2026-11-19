import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { createPersistentRefreshToken, getAccessToken, storeBiometricRefreshToken } from '../apiClient';
import { enableBiometricLogin, getBiometricAvailability } from '../biometricAuth';

jest.mock('expo-local-authentication', () => ({
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2 },
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

jest.mock('../apiClient', () => ({
  createPersistentRefreshToken: jest.fn(),
  getAccessToken: jest.fn(),
  storeBiometricRefreshToken: jest.fn(),
  disableBiometricAccessToken: jest.fn(),
  getBiometricRefreshToken: jest.fn(),
  isBiometricLoginEnabled: jest.fn(),
}));

const originalPlatform = Platform.OS;

describe('biometric sign-in', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    jest.clearAllMocks();
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  it('reports the enrolled biometric method available on the device', async () => {
    jest.mocked(LocalAuthentication.hasHardwareAsync).mockResolvedValue(true);
    jest.mocked(LocalAuthentication.isEnrolledAsync).mockResolvedValue(true);
    jest.mocked(LocalAuthentication.supportedAuthenticationTypesAsync).mockResolvedValue([
      LocalAuthentication.AuthenticationType.FINGERPRINT,
    ]);

    await expect(getBiometricAvailability()).resolves.toEqual({
      available: true,
      label: 'Fingerprint',
    });
  });

  it('does not offer enrollment when the device has no biometric hardware', async () => {
    jest.mocked(LocalAuthentication.hasHardwareAsync).mockResolvedValue(false);
    jest.mocked(LocalAuthentication.isEnrolledAsync).mockResolvedValue(false);
    jest.mocked(LocalAuthentication.supportedAuthenticationTypesAsync).mockResolvedValue([]);

    await expect(getBiometricAvailability()).resolves.toMatchObject({
      available: false,
      reason: 'This device does not have biometric hardware.',
    });
  });

  it('stores a persistent credential only after the user confirms enrollment', async () => {
    jest.mocked(getAccessToken).mockResolvedValue('session-token');
    jest.mocked(createPersistentRefreshToken).mockResolvedValue('persistent-refresh-token');
    jest.mocked(LocalAuthentication.hasHardwareAsync).mockResolvedValue(true);
    jest.mocked(LocalAuthentication.isEnrolledAsync).mockResolvedValue(true);
    jest.mocked(LocalAuthentication.supportedAuthenticationTypesAsync).mockResolvedValue([
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    ]);
    jest.mocked(LocalAuthentication.authenticateAsync).mockResolvedValue({ success: true });

    await enableBiometricLogin();

    expect(storeBiometricRefreshToken).toHaveBeenCalledWith('persistent-refresh-token', 'session-token');
  });

  it('leaves enrollment disabled when the user cancels the device prompt', async () => {
    jest.mocked(getAccessToken).mockResolvedValue('session-token');
    jest.mocked(createPersistentRefreshToken).mockResolvedValue('persistent-refresh-token');
    jest.mocked(LocalAuthentication.hasHardwareAsync).mockResolvedValue(true);
    jest.mocked(LocalAuthentication.isEnrolledAsync).mockResolvedValue(true);
    jest.mocked(LocalAuthentication.supportedAuthenticationTypesAsync).mockResolvedValue([
      LocalAuthentication.AuthenticationType.FINGERPRINT,
    ]);
    jest.mocked(LocalAuthentication.authenticateAsync).mockResolvedValue({ success: false, error: 'user_cancel' });

    await expect(enableBiometricLogin()).rejects.toThrow('Biometric setup was cancelled.');
    expect(storeBiometricRefreshToken).not.toHaveBeenCalled();
  });

  it('reports biometric sign-in as unavailable in a browser', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });

    await expect(getBiometricAvailability()).resolves.toMatchObject({
      available: false,
      reason: 'Biometric sign-in is only available in the HANDA mobile app.',
    });
    await expect(enableBiometricLogin()).rejects.toThrow('Biometric sign-in is only available in the HANDA mobile app.');
  });
});
