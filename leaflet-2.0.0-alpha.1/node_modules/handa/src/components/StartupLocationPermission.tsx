import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable } from '@components/Buttons';
import { Colors, BorderRadius, Shadows, Spacing } from '@constants/colors';
import { useTheme } from '@hooks/useTheme';

function publishWebLocationPermission(granted: boolean) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  (window as Window & { __handaLocationGranted?: boolean }).__handaLocationGranted = granted;
  window.dispatchEvent(new Event('handa-location-permission-changed'));
}

export function StartupLocationPermission() {
  const { palette } = useTheme();
  const [visible, setVisible] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [isChecking, setIsChecking] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    setIsChecking(true);
    setMessage('');
    void Location.getForegroundPermissionsAsync()
      .then((permission) => {
        if (!isMounted) return;
        setPermissionGranted(permission.granted);
        setCanAskAgain(permission.canAskAgain);
        publishWebLocationPermission(permission.granted);
      })
      .catch(() => {
        if (isMounted) {
          setMessage('Location permission status is unavailable.');
          publishWebLocationPermission(false);
        }
      })
      .finally(() => {
        if (isMounted) setIsChecking(false);
      });

    return () => { isMounted = false; };
  }, []);

  const handleAllowLocation = async () => {
    if (permissionGranted) {
      setVisible(false);
      return;
    }
    if (!canAskAgain) {
      if (Platform.OS === 'web') {
        setMessage('Location is blocked for this site. Enable it in your browser settings, then reopen HANDA.');
      } else {
        await Linking.openSettings();
      }
      return;
    }

    setIsRequesting(true);
    setMessage('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      setPermissionGranted(permission.granted);
      setCanAskAgain(permission.canAskAgain);
      publishWebLocationPermission(permission.granted);
      if (permission.granted) setVisible(false);
      else setMessage('Location is off. You can continue without GPS or allow access now.');
    } catch {
      setMessage('Location permission could not be requested. You can try again from this dialog.');
    } finally {
      setIsRequesting(false);
    }
  };

  if (!visible) return null;

  const primaryLabel = permissionGranted
    ? 'Continue'
    : canAskAgain
      ? 'Allow location'
      : Platform.OS === 'web' ? 'Location blocked' : 'Open settings';

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => setVisible(false)}>
      <View style={styles.backdrop}>
        <View style={[styles.dialog, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.icon}>
            <MaterialCommunityIcons name={permissionGranted ? 'crosshairs-gps' : 'map-marker-radius-outline'} size={27} color={Colors.white} />
          </View>
          <Text style={styles.eyebrow}>HANDA · LOCATION</Text>
          <Text style={[styles.title, { color: palette.text }]}>{permissionGranted ? 'Location access is on' : 'Allow location access?'}</Text>
          <Text style={[styles.description, { color: palette.textMuted }]}>
            {isChecking
              ? 'Checking this device’s location permission…'
              : permissionGranted
                ? 'Your live position is ready for evacuation maps and navigation.'
                : 'Allow HANDA to use GPS while you use the app so maps can show your position and guide you to evacuation centers.'}
          </Text>
          {!!message && <Text style={styles.message}>{message}</Text>}
          <AnimatedPressable
            style={[styles.primaryButton, (isChecking || (Platform.OS === 'web' && !canAskAgain && !permissionGranted)) && styles.disabledButton]}
            onPress={() => void handleAllowLocation()}
            disabled={isChecking || isRequesting || (Platform.OS === 'web' && !canAskAgain && !permissionGranted)}
            accessibilityRole="button"
          >
            {isRequesting ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.primaryText}>{primaryLabel}</Text>}
          </AnimatedPressable>
          {!permissionGranted && <AnimatedPressable style={styles.secondaryButton} onPress={() => setVisible(false)} accessibilityRole="button"><Text style={[styles.secondaryText, { color: palette.textMuted }]}>Not now</Text></AnimatedPressable>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22, backgroundColor: 'rgba(10, 29, 25, 0.58)' },
  dialog: { width: '100%', maxWidth: 410, padding: 24, borderWidth: 1, borderRadius: BorderRadius.lg, ...Shadows.lg },
  icon: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: '#218B25' },
  eyebrow: { color: Colors.secondary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { marginTop: 7, fontSize: 22, fontWeight: '800' },
  description: { marginTop: 8, fontSize: 14, lineHeight: 21 },
  message: { marginTop: 10, color: Colors.emergency, fontSize: 12, lineHeight: 18 },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 20, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#218B25' },
  disabledButton: { opacity: 0.6 },
  primaryText: { color: Colors.white, fontSize: 14, fontWeight: '800' },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  secondaryText: { fontSize: 13, fontWeight: '700' },
});
