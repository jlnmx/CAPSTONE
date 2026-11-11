import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';
import { CurrentLocationMapProps } from './CurrentLocationMap';
import useMapConnectivity from '@services/map/useMapConnectivity';
import { loadGoogleMapsApi } from '@services/map/googleMapsWeb';
import OfflineMapCanvas from './OfflineMapCanvas';

export default function CurrentLocationMap({ coordinate }: CurrentLocationMapProps) {
  const isOnline = useMapConnectivity();
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [loadError, setLoadError] = useState('');
  const [show3d, setShow3d] = useState(false);

  useEffect(() => {
    if (isOnline === null || !isOnline || !mapElement.current) return undefined;
    let active = true;
    void loadGoogleMapsApi().then(() => {
      if (!active || !mapElement.current) return;
      const position = coordinate
        ? { lat: coordinate.latitude, lng: coordinate.longitude }
        : { lat: 14.3036, lng: 121.0781 };
      const map = new google.maps.Map(mapElement.current, {
        center: position,
        zoom: coordinate ? 16 : 13,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        streetViewControl: false,
        fullscreenControl: false,
      });
      mapRef.current = map;
      if (coordinate) {
        markerRef.current = new google.maps.Marker({ map, position, title: 'Your current location' });
      }
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : 'Google Maps could not be loaded.');
    });
    return () => {
      active = false;
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
    };
  }, [coordinate, isOnline]);

  if (isOnline === null) return <MapState label="Checking map connectivity..." />;
  if (!isOnline) return <OfflineMapCanvas points={coordinate ? [{
    id: 'current-location',
    title: 'Your location',
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    color: Colors.primary,
  }] : []} />;
  if (loadError) return <MapState label={loadError} />;

  const recenter = () => {
    if (coordinate) mapRef.current?.panTo({ lat: coordinate.latitude, lng: coordinate.longitude });
  };
  const toggle3d = () => {
    const enabled = !show3d;
    setShow3d(enabled);
    mapRef.current?.setMapTypeId(enabled ? google.maps.MapTypeId.SATELLITE : google.maps.MapTypeId.ROADMAP);
    mapRef.current?.setTilt(enabled ? 45 : 0);
  };

  return (
    <View style={styles.container}>
      <View ref={mapElement as never} style={styles.map} />
      <View style={styles.controls}>
        <Pressable onPress={recenter} style={styles.control} accessibilityRole="button" accessibilityLabel="Recenter on current location">
          <MaterialCommunityIcons name="crosshairs-gps" size={19} color={Colors.primary} />
        </Pressable>
        <Pressable onPress={toggle3d} style={styles.control} accessibilityRole="button" accessibilityLabel="Toggle 3D map">
          <Text style={styles.controlText}>{show3d ? '2D' : '3D'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MapState({ label }: { label: string }) {
  return <View style={styles.state}><ActivityIndicator color={Colors.primary} /><Text style={styles.stateText}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden', backgroundColor: Colors.surfaceMuted },
  map: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.surfaceMuted },
  state: { flex: 1, gap: 10, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: Colors.surfaceMuted },
  stateText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
  controls: { position: 'absolute', right: 12, bottom: 12, gap: 7 },
  control: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: Colors.white, elevation: 4 },
  controlText: { color: Colors.primary, fontSize: 12, fontWeight: '800' },
});
