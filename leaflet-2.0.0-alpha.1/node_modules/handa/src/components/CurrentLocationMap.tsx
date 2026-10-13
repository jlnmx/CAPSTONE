import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';

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
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceMuted },
  text: { color: '#218B25', fontSize: 12 },
});