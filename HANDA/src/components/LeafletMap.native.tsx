import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Callout, Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';
import type { MapEvacuationCenter } from '@/types/index';
import useMapConnectivity from '@services/map/useMapConnectivity';
import OfflineMapCanvas from './OfflineMapCanvas';
import type { OfflineMapPoint } from './OfflineMapCanvas';
import MapNavigation from './MapNavigation';
import type { MapNavigationTarget } from './MapNavigation.types';
import MapSearchBox from './MapSearchBox';
import type { MapSearchSuggestion } from './MapSearchBox';

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
  navigationTarget?: MapNavigationTarget | null;
  onNavigationTargetChange?: (target: MapNavigationTarget | null) => void;
}

function MapMessage({ children }: { children: string }) {
  return <View style={styles.message}><Text style={styles.messageText}>{children}</Text></View>;
}

export default function LeafletMap({ centers = [], onSelectCenter, navigationTarget = null, onNavigationTargetChange }: LeafletMapProps) {
  const isOnline = useMapConnectivity();
  const mapRef = useRef<MapView>(null);
  const [query, setQuery] = useState('');
  const [show3d, setShow3d] = useState(false);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const validCenters = useMemo(() => centers.filter((center) => (
    center.latitude != null && center.longitude != null
      && Number.isFinite(Number(center.latitude)) && Number.isFinite(Number(center.longitude))
  )), [centers]);
  const localSuggestions = useMemo<MapSearchSuggestion[]>(() => validCenters.map((center) => ({
    id: `center-${center.id}`,
    title: center.name,
    subtitle: center.location || 'Evacuation center',
    latitude: Number(center.latitude),
    longitude: Number(center.longitude),
    kind: 'center',
  })), [validCenters]);

  useEffect(() => {
    let active = true;
    void Location.requestForegroundPermissionsAsync().then(async (permission) => {
      if (!active || !permission.granted) return;
      setHasLocationPermission(true);
      const subscription = await Location.watchPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 10,
        timeInterval: 5000,
      }, () => setHasLocationPermission(true));
      if (active) locationSubscription.current = subscription;
      else subscription.remove();
    }).catch(() => {
      if (active) setHasLocationPermission(false);
    });
    return () => {
      active = false;
      locationSubscription.current?.remove();
      locationSubscription.current = null;
    };
  }, []);

  if (isOnline === null) return <MapMessage>Checking map connectivity...</MapMessage>;
  if (!isOnline) return <OfflineMapCanvas points={toOfflinePoints(centers)} onSelect={onSelectCenter} />;
  if (!MAPS_API_KEY) return <MapMessage>Google Maps is not configured. Add EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY to the app build environment.</MapMessage>;

  const recenter = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Location permission needed', 'Allow location access to center the map on your position.');
        return;
      }
      setHasLocationPermission(true);
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
            <Callout onPress={() => onNavigationTargetChange?.({
              title: center.name,
              latitude: Number(center.latitude),
              longitude: Number(center.longitude),
            })}>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>{center.name}</Text>
                <Text style={styles.calloutText}>{center.location || 'Evacuation center'}</Text>
                <View style={styles.calloutNavigate}><MaterialCommunityIcons name="navigation-variant" size={15} color={Colors.white} /><Text style={styles.calloutAction}>Navigate</Text></View>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      <MapSearchBox
        query={query}
        onChangeQuery={setQuery}
        localSuggestions={localSuggestions}
        onSelect={(suggestion) => {
          mapRef.current?.animateToRegion({ latitude: suggestion.latitude, longitude: suggestion.longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 });
          if (suggestion.kind === 'center') onSelectCenter?.(suggestion.id.replace(/^center-/, ''));
        }}
        onNavigate={(suggestion) => onNavigationTargetChange?.({ title: suggestion.title, latitude: suggestion.latitude, longitude: suggestion.longitude })}
        placeholder="Search evacuation centers or places"
        accessibilityLabel="Search evacuation centers or places"
      />

      <View style={styles.controls}>
        <Pressable onPress={() => void recenter()} style={styles.control} accessibilityRole="button" accessibilityLabel="Recenter map">
          <MaterialCommunityIcons name="crosshairs-gps" size={20} color={Colors.primary} />
        </Pressable>
        <Pressable onPress={toggle3d} style={[styles.control, show3d && styles.controlActive]} accessibilityRole="button" accessibilityLabel="Toggle 3D map">
          <Text style={styles.controlLabel}>{show3d ? '2D' : '3D'}</Text>
        </Pressable>
      </View>
      {navigationTarget && <MapNavigation target={navigationTarget} onClose={() => onNavigationTargetChange?.(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden', backgroundColor: Colors.surfaceMuted },
  message: { flex: 1, padding: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceMuted },
  messageText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
  controls: { position: 'absolute', right: 12, bottom: 20, gap: 8 },
  control: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: Colors.white, elevation: 4 },
  controlActive: { backgroundColor: '#E8F2E8' },
  controlLabel: { color: Colors.primary, fontSize: 13, fontWeight: '800' },
  callout: { width: 190, padding: 4 },
  calloutTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  calloutText: { color: Colors.textMuted, fontSize: 12, marginTop: 3 },
  calloutNavigate: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 9, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.primary },
  calloutAction: { color: Colors.white, fontSize: 11, fontWeight: '800' },
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
