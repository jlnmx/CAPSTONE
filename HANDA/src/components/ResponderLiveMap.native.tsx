import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
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
  const [selectedLocation, setSelectedLocation] = useState<{ kind: 'center' | 'incident'; id: string } | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const isOnline = useMapConnectivity();
  const { responders } = useResponderLive();
  const selectedCenter = selectedLocation?.kind === 'center'
    ? data.centers.find((center) => center.id === selectedLocation.id)
    : undefined;
  const selectedIncident = selectedLocation?.kind === 'incident'
    ? data.incidents.find((incident) => incident.id === selectedLocation.id)
    : undefined;
  const selectedCapacity = selectedCenter ? Math.max(0, Number(selectedCenter.capacity) || 0) : 0;
  const selectedOccupancy = selectedCenter ? Math.max(0, Number(selectedCenter.currentOccupancy) || 0) : 0;
  const selectedAvailability = selectedCenter?.status === 'closed'
    ? 'Closed'
    : selectedCenter?.status === 'full' || selectedCapacity - selectedOccupancy <= 0
      ? 'Full'
      : selectedCenter?.status === 'limited'
        ? 'Limited availability'
        : 'Spaces available';

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
            pinColor={center.status === 'closed' || center.status === 'full' ? '#D83B36' : '#218B25'}
            onPress={() => setSelectedLocation({ kind: 'center', id: center.id })}
          />
        ))}
        {data.incidents.flatMap((incident) => incident.latitude == null || incident.longitude == null ? [] : (
          <Marker
            key={`incident-${incident.id}`}
            coordinate={{ latitude: incident.latitude, longitude: incident.longitude }}
            pinColor={incidentStatusColor(incident.status)}
            onPress={() => setSelectedLocation({ kind: 'incident', id: incident.id })}
          />
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
        onSelect={(suggestion) => {
          mapRef.current?.animateToRegion({ latitude: suggestion.latitude, longitude: suggestion.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 });
          if (suggestion.kind === 'center') setSelectedLocation({ kind: 'center', id: suggestion.id.replace(/^center-/, '') });
          if (suggestion.kind === 'incident') setSelectedLocation({ kind: 'incident', id: suggestion.id.replace(/^incident-/, '') });
          if (suggestion.kind === 'place') setSelectedLocation(null);
        }}
        onNavigate={(suggestion) => {
          setSelectedLocation(null);
          setNavigationTarget({ title: suggestion.title, latitude: suggestion.latitude, longitude: suggestion.longitude });
        }}
        placeholder="Search incidents, centers, or places"
        accessibilityLabel="Search incidents, centers, or places"
      />
      <View style={[styles.controls, (selectedCenter || selectedIncident) && styles.controlsAboveCard]}>
        <Pressable onPress={() => void recenter()} style={styles.control} accessibilityRole="button" accessibilityLabel="Recenter map"><MaterialCommunityIcons name="crosshairs-gps" size={20} color={Colors.primary} /></Pressable>
        <Pressable onPress={toggle3d} style={styles.control} accessibilityRole="button" accessibilityLabel="Toggle 3D map"><Text style={styles.controlLabel}>{show3d ? '2D' : '3D'}</Text></Pressable>
      </View>
      {(loading || error) && <View style={[styles.status, (selectedCenter || selectedIncident) && styles.statusAboveCard]}><Text style={styles.statusText}>{loading ? 'Loading live map data...' : error}</Text></View>}
      {(selectedCenter || selectedIncident) && (
        <View style={styles.locationCard} accessibilityLiveRegion="polite">
          <View style={styles.locationHeading}>
            <View style={[styles.locationIcon, { backgroundColor: selectedCenter ? '#E8F4E8' : '#FFF0E8' }]}>
              <MaterialCommunityIcons name={selectedCenter ? 'home-city-outline' : 'alert-circle-outline'} size={21} color={selectedCenter ? Colors.primary : '#C75B19'} />
            </View>
            <View style={styles.locationTitleCopy}>
              <Text style={styles.locationKind}>{selectedCenter ? 'EVACUATION CENTER' : 'INCIDENT'}</Text>
              <Text numberOfLines={2} style={styles.locationTitle}>{selectedCenter?.name ?? selectedIncident?.type}</Text>
              <Text numberOfLines={2} style={styles.locationSubtitle}>{selectedCenter?.location || selectedIncident?.location || 'Location not provided'}</Text>
            </View>
            <Pressable onPress={() => setSelectedLocation(null)} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close map details">
              <MaterialCommunityIcons name="close" size={20} color={Colors.textMuted} />
            </Pressable>
          </View>
          {selectedCenter ? (
            <>
              <View style={[styles.availability, selectedAvailability === 'Full' || selectedAvailability === 'Closed' ? styles.availabilityUnavailable : styles.availabilityAvailable]}>
                <View style={[styles.availabilityDot, selectedAvailability === 'Full' || selectedAvailability === 'Closed' ? styles.availabilityDotUnavailable : styles.availabilityDotAvailable]} />
                <Text style={[styles.availabilityText, selectedAvailability === 'Full' || selectedAvailability === 'Closed' ? styles.availabilityTextUnavailable : styles.availabilityTextAvailable]}>{selectedAvailability}</Text>
              </View>
              <View style={styles.stats}>
                <View style={styles.stat}><Text style={styles.statValue}>{selectedOccupancy} / {selectedCapacity}</Text><Text style={styles.statLabel}>People at center</Text></View>
                <View style={styles.stat}><Text style={styles.statValue}>{Math.max(0, selectedCapacity - selectedOccupancy)}</Text><Text style={styles.statLabel}>Spaces remaining</Text></View>
              </View>
            </>
          ) : (
            <View style={styles.incidentStatus}>
              <View style={[styles.incidentStatusDot, { backgroundColor: incidentStatusColor(selectedIncident!.status) }]} />
              <Text style={styles.incidentStatusText}>{selectedIncident!.status.replace(/_/g, ' ')}</Text>
            </View>
          )}
          <Pressable
            onPress={() => {
              const location = selectedCenter ?? selectedIncident;
              if (location?.latitude == null || location.longitude == null) return;
              setNavigationTarget({ title: selectedCenter?.name ?? selectedIncident!.type, latitude: location.latitude, longitude: location.longitude });
              setSelectedLocation(null);
            }}
            style={styles.navigateButton}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="navigation-variant" size={17} color={Colors.white} />
            <Text style={styles.navigateButtonText}>Navigate</Text>
          </Pressable>
        </View>
      )}
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
  controls: { position: 'absolute', right: 14, bottom: 20, gap: 8 },
  controlsAboveCard: { bottom: 260 },
  control: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: Colors.white, elevation: 5 },
  controlLabel: { color: Colors.primary, fontSize: 13, fontWeight: '800' },
  status: { position: 'absolute', left: 10, bottom: 10, maxWidth: '75%', padding: 9, borderRadius: 12, backgroundColor: Colors.white, elevation: 3 },
  statusAboveCard: { bottom: 260 },
  statusText: { color: Colors.textMuted, fontSize: 11 },
  locationCard: { position: 'absolute', left: 12, right: 12, bottom: 10, padding: 15, borderRadius: 20, backgroundColor: Colors.white, shadowColor: '#10251A', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 10 },
  locationHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locationIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  locationTitleCopy: { flex: 1, minWidth: 0 },
  locationKind: { color: Colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  locationTitle: { color: Colors.text, fontSize: 15, lineHeight: 19, fontWeight: '800', marginTop: 2 },
  locationSubtitle: { color: Colors.textMuted, fontSize: 11, lineHeight: 15, marginTop: 2 },
  closeButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#F3F6F4' },
  availability: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 11, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  availabilityAvailable: { backgroundColor: '#E8F4E8' },
  availabilityUnavailable: { backgroundColor: '#FCE8E6' },
  availabilityDot: { width: 7, height: 7, borderRadius: 4 },
  availabilityDotAvailable: { backgroundColor: Colors.primary },
  availabilityDotUnavailable: { backgroundColor: '#D83B36' },
  availabilityText: { fontSize: 10, fontWeight: '700' },
  availabilityTextAvailable: { color: Colors.primary },
  availabilityTextUnavailable: { color: '#B3261E' },
  stats: { flexDirection: 'row', gap: 8, marginTop: 10 },
  stat: { flex: 1, padding: 9, borderRadius: 12, backgroundColor: '#F3F6F8' },
  statValue: { color: Colors.text, fontSize: 15, fontWeight: '800' },
  statLabel: { color: Colors.textMuted, fontSize: 9, marginTop: 2 },
  incidentStatus: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', marginTop: 10 },
  incidentStatusDot: { width: 8, height: 8, borderRadius: 4 },
  incidentStatusText: { color: Colors.text, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  navigateButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 12, borderRadius: 13, backgroundColor: Colors.primary },
  navigateButtonText: { color: Colors.white, fontSize: 13, fontWeight: '800' },
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
