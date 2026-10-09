import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';
import { MapEvacuationCenter } from '@types/index';

interface LeafletMapProps {
  centers?: MapEvacuationCenter[];
  onSelectCenter?: (centerId: string) => void;
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
