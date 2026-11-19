import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  disableBiometricAccessToken,
  getAccessToken,
  getBiometricAccessToken,
  isBiometricLoginEnabled,
  storeBiometricAccessToken,
} from './apiClient';

export interface BiometricAvailability {
  available: boolean;
  label: string;
  reason?: string;
}

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  if (Platform.OS === 'web') {
    return {
      available: false,
      label: 'Biometric sign-in',
      reason: 'Biometric sign-in is only available in the HANDA mobile app.',
    };
  }

  const [hasHardware, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  if (!hasHardware) {
    return { available: false, label: 'Biometric sign-in', reason: 'This device does not have biometric hardware.' };
  }
  if (!isEnrolled) {
    return { available: false, label: 'Biometric sign-in', reason: 'Set up Face ID or a fingerprint in your device settings first.' };
  }

  const hasFaceRecognition = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
  const label = hasFaceRecognition && hasFingerprint
    ? 'Face recognition or fingerprint'
    : hasFaceRecognition
      ? 'Face recognition'
      : hasFingerprint
        ? 'Fingerprint'
        : 'Device biometrics';

  return { available: true, label };
}

export async function isBiometricLoginEnrolled(): Promise<boolean> {
  return isBiometricLoginEnabled();
}

export async function enableBiometricLogin(accessToken?: string): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('Biometric sign-in is only available in the HANDA mobile app.');
  }

  const token = accessToken ?? await getAccessToken();
  if (!token) throw new Error('Sign in with your password before enabling biometric sign-in.');

  const availability = await getBiometricAvailability();
  if (!availability.available) {
    throw new Error(availability.reason || 'Biometric sign-in is unavailable on this device.');
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Enable biometric sign-in for HANDA',
    cancelLabel: 'Not now',
    disableDeviceFallback: true,
  });
  if (!result.success) {
    throw new Error(result.error === 'user_cancel'
      ? 'Biometric setup was cancelled. You can enable it later in Settings.'
      : 'Biometric verification was unsuccessful. Try again or continue without it.');
  }

  await storeBiometricAccessToken(token);
}

export async function getBiometricLoginToken(): Promise<string | null> {
  return getBiometricAccessToken();
}

export async function disableBiometricLogin(): Promise<void> {
  await disableBiometricAccessToken();
}
