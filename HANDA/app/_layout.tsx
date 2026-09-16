/**
 * Root Layout
 */

import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthProvider } from '@hooks/useAuth';
import { initializeLocalDatabase } from '@services/localDatabase';
import { Colors, BorderRadius, Shadows, Spacing } from '@constants/colors';

export default function RootLayout() {
  useEffect(() => {
    initializeLocalDatabase();
  }, []);

  return (
    <AuthProvider>
      <View style={styles.root}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(admin)" />
          <Stack.Screen name="(responder)" />
          <Stack.Screen name="(resident)" />
        </Stack>
        <NavigationLoadingOverlay />
      </View>
    </AuthProvider>
  );
}

function NavigationLoadingOverlay() {
  const pathname = usePathname();
  const firstPath = useRef(pathname);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (pathname === firstPath.current) {
      return;
    }

    firstPath.current = pathname;
    setVisible(true);

    const timer = setTimeout(() => setVisible(false), 420);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.loadingCard}>
          <View style={styles.loadingIcon}>
            <MaterialCommunityIcons name="shield-check-outline" size={26} color={Colors.white} />
          </View>
          <ActivityIndicator size="small" color={Colors.secondary} />
          <Text style={styles.loadingTitle}>HANDA</Text>
          <Text style={styles.loadingMessage}>Updating response view</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 58, 99, 0.28)',
  },
  loadingCard: {
    width: 190,
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.white,
    ...Shadows.lg,
  },
  loadingIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderRadius: 26,
    backgroundColor: Colors.primary,
  },
  loadingTitle: {
    marginTop: Spacing.md,
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  loadingMessage: {
    marginTop: Spacing.xs,
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
});
