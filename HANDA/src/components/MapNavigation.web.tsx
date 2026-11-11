import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';
import { distanceMeters, distanceToRouteMeters, getMapRoutes, decodeRoutePolyline, MapCoordinate, MapRoute, MapTravelMode } from '@services/map/googleMaps';
import { loadGoogleMapsApi } from '@services/map/googleMapsWeb';
import type { MapNavigationTarget } from './MapNavigation.types';

type Props = {
  target: MapNavigationTarget | null;
  onClose: () => void;
};

export default function MapNavigation({ target, onClose }: Props) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const targetMarker = useRef<google.maps.Marker | null>(null);
  const currentMarker = useRef<google.maps.Marker | null>(null);
  const lines = useRef<google.maps.Polyline[]>([]);
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
  const [mapReady, setMapReady] = useState(false);

  const selectedRoute = routes[selectedRouteIndex] ?? null;
  selectedRouteRef.current = selectedRoute;
  const routeCoordinates = useMemo(
    () => routes.map((route) => decodeRoutePolyline(route.encodedPolyline)),
    [routes],
  );

  useEffect(() => {
    let active = true;
    void loadGoogleMapsApi().then(() => {
      if (!active || !mapElement.current || !target) return;
      const map = new google.maps.Map(mapElement.current, {
        center: { lat: target.latitude, lng: target.longitude },
        zoom: 14,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      mapRef.current = map;
      targetMarker.current = new google.maps.Marker({
        map,
        position: { lat: target.latitude, lng: target.longitude },
        title: target.title,
      });
      setMapReady(true);
    }).catch((mapError: unknown) => {
      if (active) setError(mapError instanceof Error ? mapError.message : 'Google Maps could not be loaded.');
    });
    return () => {
      active = false;
      lines.current.forEach((line) => line.setMap(null));
      lines.current = [];
      targetMarker.current?.setMap(null);
      currentMarker.current?.setMap(null);
      targetMarker.current = null;
      currentMarker.current = null;
      mapRef.current = null;
      setMapReady(false);
    };
  }, [target]);

  useEffect(() => {
    if (!target || !navigator.geolocation) {
      if (!navigator.geolocation) setError('Location access is unavailable in this browser.');
      return undefined;
    }
    let active = true;
    const watchId = navigator.geolocation.watchPosition(({ coords }) => {
      if (!active) return;
      const coordinate = { latitude: coords.latitude, longitude: coords.longitude };
      setCurrentLocation(coordinate);
      setOrigin((previous) => previous ?? coordinate);
      const route = selectedRouteRef.current;
      if (!navigating || !route) return;
      const distanceFromRoute = distanceToRouteMeters(coordinate, decodeRoutePolyline(route.encodedPolyline));
      offRouteCount.current = distanceFromRoute > 65 ? offRouteCount.current + 1 : 0;
      if (offRouteCount.current >= 2 && Date.now() - lastRerouteAt.current > 15_000) {
        offRouteCount.current = 0;
        lastRerouteAt.current = Date.now();
        setOrigin(coordinate);
        setRerouting(true);
        setRerouteRevision((value) => value + 1);
        return;
      }
      if (distanceMeters(coordinate, target) < 35) {
        setNavigating(false);
        setError('You have arrived at your destination.');
        return;
      }
      const stepEnd = route.steps[Math.min(stepIndex, route.steps.length - 1)]?.endLocation;
      if (stepEnd && distanceMeters(coordinate, stepEnd) < 30) setStepIndex((value) => Math.min(value + 1, route.steps.length - 1));
    }, (locationError) => {
      if (active) setError(locationError.message || 'Allow location access to find and follow a route.');
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
    return () => {
      active = false;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [target, navigating, stepIndex]);

  useEffect(() => {
    if (!mapReady || !currentLocation || !mapRef.current) return;
    if (!currentMarker.current) currentMarker.current = new google.maps.Marker({
      map: mapRef.current,
      position: { lat: currentLocation.latitude, lng: currentLocation.longitude },
      title: 'Your location',
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: '#1769AA', fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 2 },
    });
    else currentMarker.current.setPosition({ lat: currentLocation.latitude, lng: currentLocation.longitude });
  }, [mapReady, currentLocation]);

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
    const map = mapReady ? mapRef.current : null;
    if (!map || !target) return;
    lines.current.forEach((line) => line.setMap(null));
    lines.current = routes.map((route, index) => {
      const path = routeCoordinates[index].map((point) => ({ lat: point.latitude, lng: point.longitude }));
      return new google.maps.Polyline({
        map,
        path,
        clickable: false,
        strokeColor: index === selectedRouteIndex ? '#218B25' : '#88958C',
        strokeOpacity: index === selectedRouteIndex ? 0.9 : 0.65,
        strokeWeight: index === selectedRouteIndex ? 6 : 3,
        zIndex: index === selectedRouteIndex ? 2 : 1,
      });
    });
    if (routes.length && routeCoordinates[selectedRouteIndex]?.length) {
      const bounds = new google.maps.LatLngBounds();
      routeCoordinates[selectedRouteIndex].forEach((point) => bounds.extend({ lat: point.latitude, lng: point.longitude }));
      bounds.extend({ lat: target.latitude, lng: target.longitude });
      map.fitBounds(bounds, { top: 100, right: 35, bottom: navigating ? 270 : 245, left: 35 });
    }
  }, [mapReady, routes, routeCoordinates, selectedRouteIndex, target, navigating]);

  const startNavigation = () => {
    if (!currentLocation || !selectedRoute) {
      setError('Waiting for a current location fix before starting navigation.');
      return;
    }
    setOrigin(currentLocation);
    setNavigating(true);
    setError('');
  };
  const step = selectedRoute?.steps[stepIndex];

  if (!target) return null;
  return (
    <View style={styles.container}>
      <View ref={mapElement as never} style={styles.map} />
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Close navigation">
          <MaterialCommunityIcons name="close" size={23} color={Colors.text} />
        </Pressable>
        <View style={styles.headerCopy}><Text style={styles.eyebrow}>ROUTE TO</Text><Text numberOfLines={1} style={styles.title}>{target.title}</Text></View>
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
        <Pressable onPress={navigating ? () => setNavigating(false) : startNavigation} disabled={!selectedRoute || loading || !currentLocation} style={[styles.primaryButton, (!selectedRoute || loading || !currentLocation) && styles.buttonDisabled, navigating && styles.stopButton]} accessibilityRole="button">
          <Text style={styles.primaryButtonText}>{navigating ? 'End navigation' : 'Navigate'}</Text>
        </Pressable>
        <Text style={styles.disclaimer}>Routes need an internet connection and browser location access.</Text>
      </View>
    </View>
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
  container: { ...StyleSheet.absoluteFillObject, zIndex: 50, backgroundColor: '#E8ECEA' },
  map: { ...StyleSheet.absoluteFillObject },
  header: { position: 'absolute', top: 12, left: 12, right: 12, minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: 16, backgroundColor: Colors.white, elevation: 7, shadowColor: '#142418', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  close: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#F1F4F1' },
  headerCopy: { flex: 1 },
  eyebrow: { color: Colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: Colors.text, fontSize: 15, fontWeight: '800' },
  panel: { position: 'absolute', left: 12, right: 12, bottom: 14, maxHeight: '54%', gap: 12, padding: 16, borderRadius: 19, backgroundColor: Colors.white, elevation: 9, shadowColor: '#142418', shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 7 } },
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
