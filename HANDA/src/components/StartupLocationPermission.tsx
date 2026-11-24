import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { queueDevicePermissionPrompt } from '@services/devicePermissionPrompt';

function publishWebLocationPermission(granted: boolean) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  (window as Window & { __handaLocationGranted?: boolean }).__handaLocationGranted = granted;
  window.dispatchEvent(new Event('handa-location-permission-changed'));
}

export function StartupLocationPermission({ onPermissionGranted }: { onPermissionGranted?: () => void }) {
  const onPermissionGrantedRef = useRef(onPermissionGranted);
  onPermissionGrantedRef.current = onPermissionGranted;

  useEffect(() => {
    let active = true;

    const requestLocationPermission = async () => {
      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted && permission.canAskAgain) {
          permission = await queueDevicePermissionPrompt(() => Location.requestForegroundPermissionsAsync());
        }
        if (!active) return;

        publishWebLocationPermission(permission.granted);
        if (permission.granted) onPermissionGrantedRef.current?.();
      } catch (error) {
        console.error('Could not request location permission:', error);
        if (active) publishWebLocationPermission(false);
      }
    };

    void requestLocationPermission();
    return () => { active = false; };
  }, []);

  return null;
}
