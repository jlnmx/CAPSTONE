/**
 * Splash / Loading Screen
 */

import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing } from '@constants/colors';
import { HandaLogo } from '@components/HandaLogo';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/(auth)/login');
    }, 2500); // 2.5 second delay

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.container}>
      <HandaLogo size="large" showTagline={true} />
      
      <Text style={styles.subtitle}>
        Disaster Evacuation & Field Operations
      </Text>
      <Text style={styles.subtitle}>Management System</Text>

      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.initializingText}>Initializing...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  subtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  loaderContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  initializingText: {
    marginTop: Spacing.md,
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
});
