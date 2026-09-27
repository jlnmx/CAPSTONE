import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Camera, MapView, UserLocation } from '@maplibre/maplibre-react-native';
import { AGAP_BASE_VECTOR_STYLE, BINAN_CENTER } from '@services/map/emergencyStyle';
import { CurrentLocationMapProps } from './CurrentLocationMap';

export default function CurrentLocationMap({ coordinate }: CurrentLocationMapProps) {
  const centerCoordinate: [number, number] = coordinate
    ? [coordinate.longitude, coordinate.latitude]
    : BINAN_CENTER;

  return (
    <View style={styles.container}>
      <MapView style={styles.map} mapStyle={AGAP_BASE_VECTOR_STYLE} logoEnabled={false} attributionEnabled>
        <Camera centerCoordinate={centerCoordinate} zoomLevel={coordinate ? 16 : 12.5} animationMode="flyTo" />
        <UserLocation visible />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});