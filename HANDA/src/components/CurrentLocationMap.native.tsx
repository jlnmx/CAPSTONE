import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CurrentLocationMapProps } from './CurrentLocationMap';

export default function CurrentLocationMap({ coordinate }: CurrentLocationMapProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Map preview unavailable in Expo Go</Text>
      <Text style={styles.text}>
        {coordinate
          ? `Location: ${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`
          : 'Location is not available yet.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#e5efe8',
  },
  title: {
    color: '#218B25',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  text: {
    marginTop: 6,
    color: '#4b6350',
    fontSize: 12,
    textAlign: 'center',
  },
});