import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Callout, Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';
import { incidentStatusColor } from '@constants/incidentStatus';
import { useAuth } from '@hooks/useAuth';
import { useEvacuationCenterFeed, useIncidentFeed, useResponderLive } from '@hooks/useRealtime';
import { getResponderData, ResponderDataSnapshot } from '@services/responderData';
import useMapConnectivity from '@services/map/useMapConnectivity';
import OfflineMapCanvas from './OfflineMapCanvas';
import type { OfflineMapPoint } from './OfflineMapCanvas';
import MapNavigation from './MapNavigation';
import type { MapNavigationTarget } from './MapNavigation.types';
import MapSearchBox from './MapSearchBox';
import type { MapSearchSuggestion } from './MapSearchBox';

const CENTER: Region = { latitude: 14.3036, longitude: 121.0781, latitudeDelta: 0.045, longitudeDelta: 0.045 };
const MAPS_API_KEY = Platform.OS === 'ios'
  ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY ?? ''
  : process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY ?? '';
const EMPTY_DATA: ResponderDataSnapshot = { incidents: [], evacuees: [], registeredEvacuees: 0, disasters: [], centers: [], unavailableSources: [] };

export default function ResponderLiveMap() {
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [show3d, setShow3d] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [navigationTarget, setNavigationTarget] = useState<MapNavigationTarget | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const isOnline = useMapConnectivity();
  const { responders } = useResponderLive();

  const loadData = useCallback(async () => {
    try {
      const snapshot = await getResponderData();
      setData(snapshot);
      setError(snapshot.unavailableSources.length ? 'Some live map information could not be refreshed.' : '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Map data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);
  useIncidentFeed(() => void loadData());
  useEvacuationCenterFeed(() => void loadData());

  useEffect(() => {
    void loadData();
    const timer = setInterval(() => void loadData(), 15_000);
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
      clearInterval(timer);
      locationSubscription.current?.remove();
      locationSubscription.current = null;
    };
  }, [loadData]);

  const localSuggestions = useMemo<MapSearchSuggestion[]>(() => [
    ...data.centers.flatMap((center) => center.latitude == null || center.longitude == null
      ? []
      : [{ id: `center-${center.id}`, title: center.name, subtitle: `${center.location} · ${center.status}`, latitude: center.latitude, longitude: center.longitude, kind: 'center' as const }]),
    ...data.incidents.flatMap((incident) => incident.latitude == null || incident.longitude == null
      ? []
      : [{ id: `incident-${incident.id}`, title: incident.type, subtitle: `${incident.status.replace(/_/g, ' ')} · ${incident.location}`, latitude: incident.latitude, longitude: incident.longitude, kind: 'incident' as const }]),
  ], [data]);

  if (isOnline === null) return <MapMessage>Checking map connectivity...</MapMessage>;
  if (!isOnline && loading) return <MapMessage>Loading saved map locations...</MapMessage>;
  if (!isOnline) return <OfflineMapCanvas points={toOfflinePoints(data)} />;
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
      mapRef.current?.animateToRegion({ latitude: position.coords.latitude, longitude: position.coords.longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 });
    } catch {
      Alert.alert('Location unavailable', 'Your current position could not be read. Check device location settings and try again.');
    }
  };

  const toggle3d = () => {
    const enabled = !show3d;
    setShow3d(enabled);
    mapRef.current?.animateCamera({ pitch: enabled ? 55 : 0, heading: 0, zoom: 16 }, { duration: 450 });
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={CENTER}
        showsUserLocation={hasLocationPermission}
        showsMyLocationButton={hasLocationPermission}
        showsBuildings
        pitchEnabled
        rotateEnabled
        toolbarEnabled
      >
        {data.centers.flatMap((center) => center.latitude == null || center.longitude == null ? [] : (
          <Marker
            key={`center-${center.id}`}
            coordinate={{ latitude: center.latitude, longitude: center.longitude }}
            title={center.name}
            description={`${center.location} · ${center.currentOccupancy}/${center.capacity} · ${center.status}`}
            pinColor={center.status === 'closed' || center.status === 'full' ? '#D83B36' : '#218B25'}
          >
            <Callout onPress={() => setNavigationTarget({ title: center.name, latitude: center.latitude!, longitude: center.longitude! })}>
              <View style={styles.callout}><Text style={styles.calloutTitle}>{center.name}</Text><Text style={styles.calloutBody}>{center.currentOccupancy}/{center.capacity} · {center.status}</Text><View style={styles.calloutNavigate}><MaterialCommunityIcons name="navigation-variant" size={15} color={Colors.white} /><Text style={styles.calloutAction}>Navigate</Text></View></View>
            </Callout>
          </Marker>
        ))}
        {data.incidents.flatMap((incident) => incident.latitude == null || incident.longitude == null ? [] : (
          <Marker
            key={`incident-${incident.id}`}
            coordinate={{ latitude: incident.latitude, longitude: incident.longitude }}
            title={incident.type}
            description={`${incident.status.replace(/_/g, ' ')} · ${incident.location}`}
            pinColor={incidentStatusColor(incident.status)}
          >
            <Callout onPress={() => setNavigationTarget({ title: incident.type, latitude: incident.latitude!, longitude: incident.longitude! })}>
              <View style={styles.callout}><Text style={styles.calloutTitle}>{incident.type}</Text><Text style={styles.calloutBody}>{incident.status.replace(/_/g, ' ')} · {incident.location}</Text><View style={styles.calloutNavigate}><MaterialCommunityIcons name="navigation-variant" size={15} color={Colors.white} /><Text style={styles.calloutAction}>Navigate</Text></View></View>
            </Callout>
          </Marker>
        ))}
        {Object.values(responders).flatMap((responder) => {
          if (!responder.location || responder.user_id === user?.id) return [];
          const coordinate = { latitude: responder.location.latitude, longitude: responder.location.longitude };
          if (!Number.isFinite(coordinate.latitude) || !Number.isFinite(coordinate.longitude)) return [];
          return <Marker key={`responder-${responder.user_id}`} coordinate={coordinate} title="Responder" description={responder.availability} pinColor="#1769AA" />;
        })}
      </MapView>

      <MapSearchBox
        query={query}
        onChangeQuery={setQuery}
        localSuggestions={localSuggestions}
        onSelect={(suggestion) => mapRef.current?.animateToRegion({ latitude: suggestion.latitude, longitude: suggestion.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 })}
        onNavigate={(suggestion) => setNavigationTarget({ title: suggestion.title, latitude: suggestion.latitude, longitude: suggestion.longitude })}
        placeholder="Search incidents, centers, or places"
        accessibilityLabel="Search incidents, centers, or places"
      />
      <View style={styles.controls}>
        <Pressable onPress={() => void recenter()} style={styles.control} accessibilityRole="button" accessibilityLabel="Recenter map"><MaterialCommunityIcons name="crosshairs-gps" size={20} color={Colors.primary} /></Pressable>
        <Pressable onPress={toggle3d} style={styles.control} accessibilityRole="button" accessibilityLabel="Toggle 3D map"><Text style={styles.controlLabel}>{show3d ? '2D' : '3D'}</Text></Pressable>
      </View>
      {(loading || error) && <View style={styles.status}><Text style={styles.statusText}>{loading ? 'Loading live map data...' : error}</Text></View>}
      {navigationTarget && <MapNavigation target={navigationTarget} onClose={() => setNavigationTarget(null)} />}
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
  controls: { position: 'absolute', right: 12, bottom: 20, gap: 8 },
  control: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: Colors.white, elevation: 4 },
  controlLabel: { color: Colors.primary, fontSize: 13, fontWeight: '800' },
  status: { position: 'absolute', left: 10, bottom: 10, maxWidth: '75%', padding: 8, borderRadius: 6, backgroundColor: Colors.white, elevation: 3 },
  statusText: { color: Colors.textMuted, fontSize: 11 },
  callout: { width: 200, padding: 4 },
  calloutTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  calloutBody: { color: Colors.textMuted, fontSize: 12, marginTop: 3 },
  calloutNavigate: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 9, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.primary },
  calloutAction: { color: Colors.white, fontSize: 11, fontWeight: '800' },
});

function toOfflinePoints(data: ResponderDataSnapshot): OfflineMapPoint[] {
  return [
    ...data.centers.flatMap((center) => center.latitude == null || center.longitude == null
      ? []
      : [{
        id: `center-${center.id}`,
        title: center.name,
        description: `${center.currentOccupancy}/${center.capacity} · ${center.status}`,
        latitude: center.latitude,
        longitude: center.longitude,
        color: center.status === 'closed' || center.status === 'full' ? '#D83B36' : '#218B25',
      }]),
    ...data.incidents.flatMap((incident) => incident.latitude == null || incident.longitude == null
      ? []
      : [{
        id: `incident-${incident.id}`,
        title: incident.type,
        description: `${incident.status.replace(/_/g, ' ')} · ${incident.location}`,
        latitude: incident.latitude,
        longitude: incident.longitude,
        color: incidentStatusColor(incident.status),
      }]),
  ];
}
