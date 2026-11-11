import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import MapView, { Callout, Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';
import type { MapEvacuationCenter } from '@/types/index';
import useMapConnectivity from '@services/map/useMapConnectivity';
import OfflineMapCanvas from './OfflineMapCanvas';
import type { OfflineMapPoint } from './OfflineMapCanvas';

const BINAN_REGION: Region = {
  latitude: 14.3036,
  longitude: 121.0781,
  latitudeDelta: 0.045,
  longitudeDelta: 0.045,
};
const MAPS_API_KEY = Platform.OS === 'ios'
  ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY ?? ''
  : process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY ?? '';

interface LeafletMapProps {
  centers?: MapEvacuationCenter[];
  onSelectCenter?: (centerId: string) => void;
}

function MapMessage({ children }: { children: string }) {
  return <View style={styles.message}><Text style={styles.messageText}>{children}</Text></View>;
}

export default function LeafletMap({ centers = [], onSelectCenter }: LeafletMapProps) {
  const isOnline = useMapConnectivity();
  const mapRef = useRef<MapView>(null);
  const [query, setQuery] = useState('');
  const [show3d, setShow3d] = useState(false);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const validCenters = useMemo(() => centers.filter((center) => (
    center.latitude != null && center.longitude != null
      && Number.isFinite(Number(center.latitude)) && Number.isFinite(Number(center.longitude))
  )), [centers]);

  useEffect(() => {
    void Location.getForegroundPermissionsAsync().then((permission) => {
      setHasLocationPermission(permission.granted);
    });
  }, []);

  if (isOnline === null) return <MapMessage>Checking map connectivity...</MapMessage>;
  if (!isOnline) return <OfflineMapCanvas points={toOfflinePoints(centers)} onSelect={onSelectCenter} />;
  if (!MAPS_API_KEY) return <MapMessage>Google Maps is not configured. Add EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY to the app build environment.</MapMessage>;

  const search = async () => {
    const term = query.trim();
    if (!term) return;
    const normalized = term.toLocaleLowerCase();
    const center = validCenters.find((item) => `${item.name} ${item.location}`.toLocaleLowerCase().includes(normalized));
    if (center) {
      mapRef.current?.animateToRegion({
        latitude: Number(center.latitude),
        longitude: Number(center.longitude),
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      });
      onSelectCenter?.(center.id);
      return;
    }

    try {
      await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(term)}`);
    } catch {
      Alert.alert('Search unavailable', 'Google Maps search could not be opened on this device.');
    }
  };

  const recenter = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Location permission needed', 'Allow location access to center the map on your position.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      mapRef.current?.animateToRegion({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      });
    } catch {
      Alert.alert('Location unavailable', 'Your current position could not be read. Check device location settings and try again.');
    }
  };

  const toggle3d = () => {
    const enabled = !show3d;
    setShow3d(enabled);
    setMapType(enabled ? 'satellite' : 'standard');
    mapRef.current?.animateCamera({ pitch: enabled ? 55 : 0, heading: 0, zoom: 16 }, { duration: 450 });
  };

  const navigateTo = async (center: MapEvacuationCenter) => {
    const destination = `${center.latitude},${center.longitude}`;
    try {
      await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=walking`);
    } catch {
      Alert.alert('Navigation unavailable', 'Google Maps directions could not be opened.');
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={BINAN_REGION}
        mapType={mapType}
        showsUserLocation={hasLocationPermission}
        showsMyLocationButton={hasLocationPermission}
        showsBuildings
        pitchEnabled
        rotateEnabled
        toolbarEnabled
      >
        {validCenters.map((center) => (
          <Marker
            key={center.id}
            coordinate={{ latitude: Number(center.latitude), longitude: Number(center.longitude) }}
            title={center.name}
            description={`${center.location || 'Evacuation center'} · ${center.status}`}
            pinColor={center.status === 'closed' || center.status === 'full' ? '#D83B36' : '#218B25'}
            onPress={() => onSelectCenter?.(center.id)}
          >
            <Callout onPress={() => void navigateTo(center)}>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>{center.name}</Text>
                <Text style={styles.calloutText}>{center.location || 'Evacuation center'}</Text>
                <Text style={styles.calloutAction}>Tap for walking directions</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      <View style={styles.searchBar}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void search()}
          placeholder="Search centers or places"
          placeholderTextColor={Colors.textMuted}
          returnKeyType="search"
          accessibilityLabel="Search evacuation centers or places"
          style={styles.searchInput}
        />
        <Pressable onPress={() => void search()} accessibilityRole="button" accessibilityLabel="Search map">
          <MaterialCommunityIcons name="magnify" size={23} color={Colors.primary} />
        </Pressable>
      </View>

      <View style={styles.controls}>
        <Pressable onPress={() => void recenter()} style={styles.control} accessibilityRole="button" accessibilityLabel="Recenter map">
          <MaterialCommunityIcons name="crosshairs-gps" size={20} color={Colors.primary} />
        </Pressable>
        <Pressable onPress={toggle3d} style={[styles.control, show3d && styles.controlActive]} accessibilityRole="button" accessibilityLabel="Toggle 3D map">
          <Text style={styles.controlLabel}>{show3d ? '2D' : '3D'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden', backgroundColor: Colors.surfaceMuted },
  message: { flex: 1, padding: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceMuted },
  messageText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
  searchBar: { position: 'absolute', top: 12, left: 12, right: 12, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: Colors.white, elevation: 4 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14, paddingVertical: 10 },
  controls: { position: 'absolute', right: 12, bottom: 20, gap: 8 },
  control: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: Colors.white, elevation: 4 },
  controlActive: { backgroundColor: '#E8F2E8' },
  controlLabel: { color: Colors.primary, fontSize: 13, fontWeight: '800' },
  callout: { width: 190, padding: 4 },
  calloutTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  calloutText: { color: Colors.textMuted, fontSize: 12, marginTop: 3 },
  calloutAction: { color: Colors.primary, fontSize: 11, fontWeight: '700', marginTop: 8 },
});

function toOfflinePoints(centers: MapEvacuationCenter[]): OfflineMapPoint[] {
  return centers.flatMap((center) => center.latitude == null || center.longitude == null
    ? []
    : [{
      id: center.id,
      title: center.name,
      description: `${center.location || 'Evacuation center'} · ${center.status}`,
      latitude: center.latitude,
      longitude: center.longitude,
      color: center.status === 'closed' || center.status === 'full' ? '#D83B36' : Colors.primary,
    }]);
}
