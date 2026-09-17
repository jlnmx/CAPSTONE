/**
 * Resident Report Screen - Placeholder
 */

import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { Colors, Spacing } from '@constants/colors';
import { EmptyState } from '@components/ScreenHeader';

export default function ResidentReportScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <EmptyState
        icon="📢"
        title="Submit Report"
        description="Report safety concerns, injuries, or incidents to emergency responders. This module is coming soon."
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
