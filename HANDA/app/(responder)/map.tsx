/**
 * Map Screen - Placeholder
 */

import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { Colors, Spacing } from '@constants/colors';
import { EmptyState } from '@components/ScreenHeader';

export default function MapScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <EmptyState
        icon="🗺️"
        title="Map Module"
        description="This module is coming soon. You will be able to view real-time operational maps with GPS tracking from this screen."
        actionLabel="Back to Dashboard"
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
