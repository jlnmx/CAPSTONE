import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';
import { distanceMeters, distanceToRouteMeters, getMapRoutes, decodeRoutePolyline, MapCoordinate, MapRoute, MapTravelMode } from '@services/map/googleMaps';
import type { MapNavigationTarget } from './MapNavigation.types';

type Props = {
  target: MapNavigationTarget | null;
  onClose: () => void;
};

export default function MapNavigation({ target, onClose }: Props) {
  const mapRef = useRef<MapView>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const selectedRouteRef = useRef<MapRoute | null>(null);
  const offRouteCount = useRef(0);
  const lastRerouteAt = useRef(0);
  const [origin, setOrigin] = useState<MapCoordinate | null>(null);
  const [currentLocation, setCurrentLocation] = useState<MapCoordinate | null>(null);
  const [routes, setRoutes] = useState<MapRoute[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [mode, setMode] = useState<MapTravelMode>('DRIVE');
  const [loading, setLoading] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [rerouting, setRerouting] = useState(false);
  const [error, setError] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [rerouteRevision, setRerouteRevision] = useState(0);

  const selectedRoute = routes[selectedRouteIndex] ?? null;
  selectedRouteRef.current = selectedRoute;
  const routeCoordinates = useMemo(
    () => routes.map((route) => decodeRoutePolyline(route.encodedPolyline)),
    [routes],
  );
  const region: Region = {
    latitude: origin?.latitude ?? target?.latitude ?? 14.3036,
    longitude: origin?.longitude ?? target?.longitude ?? 121.0781,
    latitudeDelta: 0.045,
    longitudeDelta: 0.045,
  };

  useEffect(() => {
    let active = true;
    const locate = async () => {
      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          if (active) setError('Allow location access to calculate and follow a route.');
          return;
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (!active) return;
        const coordinate = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setCurrentLocation(coordinate);
        setOrigin(coordinate);
        setError('');
      } catch {
        if (active) setError('Your current location is unavailable. Check location settings and try again.');
      }
    };
    void locate();
    return () => {
      active = false;
      locationSubscription.current?.remove();
      locationSubscription.current = null;
    };
  }, []);

  useEffect(() => {
    if (!origin || !target) return;
    let active = true;
    setLoading(true);
    setError('');
    void getMapRoutes(origin, target, mode).then((result) => {
      if (!active) return;
      setRoutes(result);
      setSelectedRouteIndex(0);
      setStepIndex(0);
      setRerouting(false);
      if (!result.length) setError('No route was found for this destination and travel mode.');
    }).catch((routeError: unknown) => {
      if (active) {
        setRoutes([]);
        setRerouting(false);
        setError(routeError instanceof Error ? routeError.message : 'Routes could not be calculated. Check your connection and try again.');
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [origin, target, mode, rerouteRevision]);

  useEffect(() => {
    if (!routes.length || !target) return;
    const coordinates = routeCoordinates[selectedRouteIndex] ?? [];
    if (!coordinates.length) return;
    mapRef.current?.fitToCoordinates([...coordinates, target], {
      edgePadding: { top: 100, right: 35, bottom: navigating ? 250 : 220, left: 35 },
      animated: true,
    });
  }, [routeCoordinates, routes.length, selectedRouteIndex, target, navigating]);

  useEffect(() => {
    if (!navigating) {
      locationSubscription.current?.remove();
      locationSubscription.current = null;
      return undefined;
    }
    let active = true;
    let subscription: Location.LocationSubscription | null = null;
    void Location.watchPositionAsync({
      accuracy: Location.Accuracy.High,
      distanceInterval: 5,
      timeInterval: 3000,
    }, (position) => {
      if (!active || !target) return;
      const current = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setCurrentLocation(current);
      const route = selectedRouteRef.current;
      if (!route) return;
      const distanceFromRoute = distanceToRouteMeters(current, decodeRoutePolyline(route.encodedPolyline));
      offRouteCount.current = distanceFromRoute > 65 ? offRouteCount.current + 1 : 0;
      if (offRouteCount.current >= 2 && Date.now() - lastRerouteAt.current > 15_000) {
        offRouteCount.current = 0;
        lastRerouteAt.current = Date.now();
        setOrigin(current);
        setRerouting(true);
        setRerouteRevision((value) => value + 1);
        return;
      }
      if (distanceMeters(current, target) < 35) {
        setNavigating(false);
        setError('You have arrived at your destination.');
        return;
      }
      const currentStepIndex = Math.min(stepIndex, route.steps.length - 1);
      const stepEnd = route.steps[currentStepIndex]?.endLocation;
      if (stepEnd && distanceMeters(current, stepEnd) < 30) setStepIndex((value) => Math.min(value + 1, route.steps.length - 1));
    }).then((nextSubscription) => {
      if (active) {
        subscription = nextSubscription;
        locationSubscription.current = nextSubscription;
      } else {
        nextSubscription.remove();
      }
    }).catch(() => {
      if (active) setError('Location tracking stopped. Check location permission and try starting navigation again.');
    });
    return () => {
      active = false;
      subscription?.remove();
      if (locationSubscription.current === subscription) locationSubscription.current = null;
    };
  }, [navigating, stepIndex, target]);

  const startNavigation = async () => {
    if (!currentLocation || !selectedRoute) return;
    let permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      setError('Location access is required for off-route detection and automatic rerouting.');
      return;
    }
    setOrigin(currentLocation);
    setNavigating(true);
    setError('');
  };

  const step = selectedRoute?.steps[stepIndex];

  return (
    <Modal visible={Boolean(target)} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          showsUserLocation={Boolean(currentLocation)}
          followsUserLocation={navigating}
          showsCompass
          toolbarEnabled={false}
        >
          {target && <Marker coordinate={target} title={target.title} pinColor="#D83B36" />}
          {routes.map((route, index) => {
            const coordinates = routeCoordinates[index];
            return coordinates?.length ? <Polyline
              key={route.id}
              coordinates={coordinates}
              strokeColor={index === selectedRouteIndex ? Colors.primary : '#88958C'}
              strokeWidth={index === selectedRouteIndex ? 6 : 3}
              lineDashPattern={index === selectedRouteIndex ? undefined : [5, 6]}
              zIndex={index === selectedRouteIndex ? 2 : 1}
            /> : null;
          })}
        </MapView>

        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Close navigation">
            <MaterialCommunityIcons name="close" size={23} color={Colors.text} />
          </Pressable>
          <View style={styles.headerCopy}><Text style={styles.eyebrow}>ROUTE TO</Text><Text numberOfLines={1} style={styles.title}>{target?.title}</Text></View>
        </View>

        <View style={styles.panel}>
          <View style={styles.modeRow}>
            {(['DRIVE', 'WALK'] as const).map((travelMode) => <Pressable
              key={travelMode}
              onPress={() => {
                if (navigating && currentLocation) setOrigin(currentLocation);
                setMode(travelMode);
              }}
              style={[styles.modeButton, mode === travelMode && styles.modeButtonSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === travelMode }}
            >
              <MaterialCommunityIcons name={travelMode === 'DRIVE' ? 'car' : 'walk'} size={18} color={mode === travelMode ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.modeLabel, mode === travelMode && styles.modeLabelSelected]}>{travelMode === 'DRIVE' ? 'Driving' : 'Walking'}</Text>
            </Pressable>)}
          </View>

          {loading ? <View style={styles.loading}><ActivityIndicator color={Colors.primary} /><Text style={styles.muted}>{rerouting ? 'Recalculating route…' : 'Finding routes…'}</Text></View> : null}
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

          {!loading && routes.length > 0 && !navigating && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.routeList}>
            {routes.map((route, index) => <Pressable
              key={route.id}
              onPress={() => { setSelectedRouteIndex(index); setStepIndex(0); }}
              style={[styles.routeOption, index === selectedRouteIndex && styles.routeOptionSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected: index === selectedRouteIndex }}
            >
              <Text style={styles.routeTime}>{formatDuration(route.durationSeconds)}</Text>
              <Text style={styles.routeDistance}>{index === 0 ? 'Recommended · ' : 'Alternate · '}{formatDistance(route.distanceMeters)}</Text>
            </Pressable>)}
          </ScrollView>}

          {navigating && <View style={styles.instruction}>
            <MaterialCommunityIcons name={mode === 'DRIVE' ? 'navigation' : 'walk'} size={22} color={Colors.primary} />
            <View style={styles.instructionCopy}>
              <Text style={styles.instructionTitle}>{rerouting ? 'Recalculating route…' : step?.instruction ?? 'Continue to your destination'}</Text>
              {step ? <Text style={styles.muted}>{formatDistance(step.distanceMeters)} · {formatDuration(selectedRoute?.durationSeconds ?? 0)} trip</Text> : null}
            </View>
          </View>}

          <Pressable
            onPress={navigating ? () => setNavigating(false) : () => void startNavigation()}
            disabled={!selectedRoute || loading || !currentLocation}
            style={[styles.primaryButton, (!selectedRoute || loading || !currentLocation) && styles.buttonDisabled, navigating && styles.stopButton]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>{navigating ? 'End navigation' : 'Navigate'}</Text>
          </Pressable>
          <Text style={styles.disclaimer}>Routes need an internet connection and foreground location access.</Text>
        </View>
      </View>
    </Modal>
  );
}

function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min` : `${minutes} min`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8ECEA' },
  header: { position: 'absolute', top: 12, left: 12, right: 12, minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: 16, backgroundColor: Colors.white, elevation: 7 },
  close: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#F1F4F1' },
  headerCopy: { flex: 1 },
  eyebrow: { color: Colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: Colors.text, fontSize: 15, fontWeight: '800' },
  panel: { position: 'absolute', left: 12, right: 12, bottom: 14, maxHeight: '54%', gap: 12, padding: 16, borderRadius: 19, backgroundColor: Colors.white, elevation: 9 },
  modeRow: { flexDirection: 'row', gap: 9 },
  modeButton: { flex: 1, minHeight: 46, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: '#F3F6F2' },
  modeButtonSelected: { backgroundColor: '#E7F4E7', borderWidth: 1, borderColor: '#9BCB99' },
  modeLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
  modeLabelSelected: { color: Colors.primary },
  loading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 },
  muted: { color: Colors.textMuted, fontSize: 11 },
  error: { color: '#A52D2D', fontSize: 11, textAlign: 'center' },
  routeList: { gap: 8, paddingVertical: 2 },
  routeOption: { minWidth: 142, padding: 12, borderWidth: 1, borderColor: '#DDE5DD', borderRadius: 12, backgroundColor: '#FAFCFA' },
  routeOptionSelected: { borderColor: Colors.primary, backgroundColor: '#F0F8EF' },
  routeTime: { color: Colors.text, fontSize: 15, fontWeight: '800' },
  routeDistance: { marginTop: 3, color: Colors.textMuted, fontSize: 10 },
  instruction: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 13, backgroundColor: '#F0F8EF' },
  instructionCopy: { flex: 1, gap: 3 },
  instructionTitle: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: Colors.primary },
  primaryButtonText: { color: Colors.white, fontSize: 14, fontWeight: '800' },
  stopButton: { backgroundColor: '#8E3131' },
  buttonDisabled: { opacity: 0.5 },
  disclaimer: { color: Colors.textMuted, fontSize: 9, textAlign: 'center' },
});
