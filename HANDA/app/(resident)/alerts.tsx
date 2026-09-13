/**
 * Resident Alerts Screen - Placeholder
 */

import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { Colors, Spacing } from '@constants/colors';
import { EmptyState } from '@components/ScreenHeader';

export default function ResidentAlertsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <EmptyState
        icon="🔔"
        title="Alerts"
        description="Receive real-time emergency alerts and updates about evacuation procedures and disaster status."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
});
