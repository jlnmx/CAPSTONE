/**
 * More Screen - Placeholder
 */

import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { Colors, Spacing } from '@constants/colors';
import { EmptyState } from '@components/ScreenHeader';

export default function MoreScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <EmptyState
        icon="⋯"
        title="More Options"
        description="Additional features and settings will be available here. This could include offline data management, synchronization status, and user preferences."
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
