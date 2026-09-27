import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type LocationCoordinate = {
  latitude: number;
  longitude: number;
};

export type CurrentLocationMapProps = {
  coordinate?: LocationCoordinate;
};

export default function CurrentLocationMap({ coordinate }: CurrentLocationMapProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{coordinate ? 'Current location loaded' : 'Getting your location...'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e5efe8' },
  text: { color: '#218B25', fontSize: 12 },
});