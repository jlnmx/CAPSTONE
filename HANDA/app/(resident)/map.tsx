/**
 * Resident Map Screen - Placeholder
 */

import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { Colors, Spacing } from '@constants/colors';
import { EmptyState } from '@components/ScreenHeader';

export default function ResidentMapScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <EmptyState
        icon="🗺️"
        title="Map Module"
        description="View evacuation routes and nearby evacuation centers on the map. This module is coming soon."
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
