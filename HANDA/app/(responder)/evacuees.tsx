/**
 * Evacuees Screen - Placeholder
 */

import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { Colors, Spacing } from '@constants/colors';
import { EmptyState } from '@components/ScreenHeader';

export default function EvacueesScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <EmptyState
        icon="👥"
        title="Evacuees Module"
        description="This module is coming soon. You will be able to register, manage, and track evacuees from this screen."
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
