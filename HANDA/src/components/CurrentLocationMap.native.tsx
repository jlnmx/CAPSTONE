import React, { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';
import { CurrentLocationMapProps } from './CurrentLocationMap';
import useMapConnectivity from '@services/map/useMapConnectivity';
import OfflineMapCanvas from './OfflineMapCanvas';

const BINAN_REGION: Region = {
  latitude: 14.3036,
  longitude: 121.0781,
  latitudeDelta: 0.045,
  longitudeDelta: 0.045,
};
const MAPS_API_KEY = Platform.OS === 'ios'
  ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY ?? ''
  : process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY ?? '';

export default function CurrentLocationMap({ coordinate }: CurrentLocationMapProps) {
  const isOnline = useMapConnectivity();
  const mapRef = useRef<MapView>(null);
  const [show3d, setShow3d] = useState(false);

  useEffect(() => {
    if (coordinate) {
      mapRef.current?.animateToRegion({ ...coordinate, latitudeDelta: 0.008, longitudeDelta: 0.008 });
    }
  }, [coordinate]);

  if (isOnline === null) return <MapMessage>Checking map connectivity...</MapMessage>;
  if (!isOnline) return <OfflineMapCanvas points={coordinate ? [{
    id: 'current-location',
    title: 'Your location',
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    color: Colors.primary,
  }] : []} />;
  if (!MAPS_API_KEY) return <MapMessage>Google Maps is not configured. Add EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY to the app build environment.</MapMessage>;

  const recenter = async () => {
    if (!coordinate) {
      Alert.alert('Location unavailable', 'A current location is not available yet.');
      return;
    }
    mapRef.current?.animateToRegion({ ...coordinate, latitudeDelta: 0.008, longitudeDelta: 0.008 });
  };
  const toggle3d = () => {
    const enabled = !show3d;
    setShow3d(enabled);
    mapRef.current?.animateCamera({ pitch: enabled ? 55 : 0, heading: 0, zoom: 16 }, { duration: 450 });
  };
  const openDirections = async () => {
    if (!coordinate) return;
    try {
      await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${coordinate.latitude},${coordinate.longitude}`);
    } catch {
      Alert.alert('Maps unavailable', 'Google Maps could not be opened.');
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={coordinate ? { ...coordinate, latitudeDelta: 0.012, longitudeDelta: 0.012 } : BINAN_REGION}
        showsBuildings
        pitchEnabled
        rotateEnabled
      >
        {coordinate && <Marker coordinate={coordinate} title="Your current location" pinColor="#218B25" />}
      </MapView>
      <View style={styles.controls}>
        <Pressable onPress={recenter} style={styles.control} accessibilityRole="button" accessibilityLabel="Recenter on current location">
          <MaterialCommunityIcons name="crosshairs-gps" size={19} color={Colors.primary} />
        </Pressable>
        <Pressable onPress={toggle3d} style={styles.control} accessibilityRole="button" accessibilityLabel="Toggle 3D map">
          <Text style={styles.controlText}>{show3d ? '2D' : '3D'}</Text>
        </Pressable>
        {coordinate && <Pressable onPress={() => void openDirections()} style={styles.control} accessibilityRole="button" accessibilityLabel="Open location in Google Maps">
          <MaterialCommunityIcons name="directions" size={20} color={Colors.primary} />
        </Pressable>}
      </View>
    </View>
  );
}

function MapMessage({ children }: { children: string }) {
  return <View style={styles.message}><Text style={styles.messageText}>{children}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden', backgroundColor: Colors.surfaceMuted },
  message: { flex: 1, padding: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceMuted },
  messageText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
  controls: { position: 'absolute', right: 12, bottom: 12, gap: 7 },
  control: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: Colors.white, elevation: 4 },
  controlText: { color: Colors.primary, fontSize: 12, fontWeight: '800' },
});
