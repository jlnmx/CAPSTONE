/**
 * Resident More Screen - Placeholder
 */

import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { Colors, Spacing } from '@constants/colors';
import { EmptyState } from '@components/ScreenHeader';

export default function ResidentMoreScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <EmptyState
        icon="⋯"
        title="More Options"
        description="Additional features, settings, and user preferences will be available here."
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
