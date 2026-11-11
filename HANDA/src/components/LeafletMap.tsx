import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';
import type { MapEvacuationCenter } from '@/types/index';
import type { MapNavigationTarget } from './MapNavigation.types';

interface LeafletMapProps {
  centers?: MapEvacuationCenter[];
  onSelectCenter?: (centerId: string) => void;
  navigationTarget?: MapNavigationTarget | null;
  onNavigationTargetChange?: (target: MapNavigationTarget | null) => void;
}

export default function LeafletMap({ centers = [] }: LeafletMapProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{centers.length ? 'Map view is not available on this platform.' : 'Evacuation centers are unavailable.'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceMuted,
  },
  text: {
    color: '#218B25',
    fontSize: 14,
  },
});
