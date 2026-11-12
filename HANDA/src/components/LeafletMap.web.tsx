import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';
import type { MapEvacuationCenter } from '@/types/index';
import useMapConnectivity from '@services/map/useMapConnectivity';
import { loadGoogleMapsApi } from '@services/map/googleMapsWeb';
import { createEvacuationCenterInfoContent } from '@services/map/evacuationCenterInfoContent';
import OfflineMapCanvas from './OfflineMapCanvas';
import type { OfflineMapPoint } from './OfflineMapCanvas';
import MapNavigation from './MapNavigation';
import type { MapNavigationTarget } from './MapNavigation.types';
import MapSearchBox from './MapSearchBox';
import type { MapSearchSuggestion } from './MapSearchBox';

const BINAN = { lat: 14.3036, lng: 121.0781 };

interface LeafletMapProps {
  centers?: MapEvacuationCenter[];
  onSelectCenter?: (centerId: string) => void;
  navigationTarget?: MapNavigationTarget | null;
  onNavigationTargetChange?: (target: MapNavigationTarget | null) => void;
}

export default function LeafletMap({ centers = [], onSelectCenter, navigationTarget = null, onNavigationTargetChange }: LeafletMapProps) {
  const isOnline = useMapConnectivity();
  const mapElement = useRef<HTMLDivElement | null>(null);
  const [loadError, setLoadError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [query, setQuery] = useState('');
  const [show3d, setShow3d] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const onSelectCenterRef = useRef(onSelectCenter);
  const onNavigationTargetChangeRef = useRef(onNavigationTargetChange);
  onSelectCenterRef.current = onSelectCenter;
  onNavigationTargetChangeRef.current = onNavigationTargetChange;
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
    if (isOnline === null || !isOnline || !mapElement.current) return undefined;
    let active = true;
    void loadGoogleMapsApi().then(() => {
      if (!active || !mapElement.current) return;
      const map = new google.maps.Map(mapElement.current, {
        center: BINAN,
        zoom: 13,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        tilt: 0,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: false,
      });
      mapRef.current = map;
      setMapReady(true);
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : 'Google Maps could not be loaded.');
    });

    return () => {
      active = false;
      userMarkerRef.current?.setMap(null);
      userMarkerRef.current = null;
      mapRef.current = null;
      setMapReady(false);
    };
  }, [isOnline]);

  useEffect(() => {
    const map = mapReady ? mapRef.current : null;
    if (!map) return undefined;
    markersRef.current.forEach((marker) => marker.setMap(null));
    const infoWindows: google.maps.InfoWindow[] = [];
    markersRef.current = validCenters.map((center) => {
      const marker = new google.maps.Marker({
        map,
        position: { lat: Number(center.latitude), lng: Number(center.longitude) },
        title: center.name,
        icon: center.status === 'closed' || center.status === 'full'
          ? undefined
          : { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#218B25', fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 2 },
      });
      const info = new google.maps.InfoWindow({
        content: createEvacuationCenterInfoContent(center, () => onNavigationTargetChangeRef.current?.({
          title: center.name,
          latitude: Number(center.latitude),
          longitude: Number(center.longitude),
        })),
        maxWidth: 280,
      });
      infoWindows.push(info);
      marker.addListener('click', () => {
        info.open({ map, anchor: marker });
        onSelectCenterRef.current?.(center.id);
      });
      return marker;
    });
    return () => {
      infoWindows.forEach((info) => info.close());
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
    };
  }, [mapReady, validCenters]);

  useEffect(() => {
    if (!isOnline || !mapReady || !mapRef.current || !navigator.geolocation) return undefined;
    const watchId = navigator.geolocation.watchPosition(({ coords }) => {
      const position = { lat: coords.latitude, lng: coords.longitude };
      setLocationError('');
      if (!userMarkerRef.current) {
        userMarkerRef.current = new google.maps.Marker({
          map: mapRef.current,
          position,
          title: 'Your location',
          zIndex: 1000,
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#1769AA', fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 3 },
        });
      } else {
        userMarkerRef.current.setPosition(position);
      }
    }, () => {
      setLocationError('Allow browser location access to show your current location.');
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
    return () => {
      navigator.geolocation.clearWatch(watchId);
      userMarkerRef.current?.setMap(null);
      userMarkerRef.current = null;
    };
  }, [isOnline, mapReady]);

  if (isOnline === null) return <MapState label="Checking map connectivity..." />;
  if (!isOnline) return <OfflineMapCanvas points={toOfflinePoints(centers)} onSelect={onSelectCenter} />;
  if (loadError) return <MapState label={loadError} />;

  const recenter = () => {
    if (!navigator.geolocation) {
      setLocationError('Location access is unavailable in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocationError('');
        const position = { lat: coords.latitude, lng: coords.longitude };
        if (!userMarkerRef.current && mapRef.current) {
          userMarkerRef.current = new google.maps.Marker({
            map: mapRef.current,
            position,
            title: 'Your location',
            zIndex: 1000,
            icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#1769AA', fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 3 },
          });
        } else userMarkerRef.current?.setPosition(position);
        mapRef.current?.panTo({ lat: coords.latitude, lng: coords.longitude });
        mapRef.current?.setZoom(16);
      },
      () => setLocationError('Could not access your location. Allow location access in browser settings and retry.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const toggle3d = () => {
    const enabled = !show3d;
    setShow3d(enabled);
    const nextType = enabled ? google.maps.MapTypeId.SATELLITE : google.maps.MapTypeId.ROADMAP;
    mapRef.current?.setMapTypeId(nextType);
    mapRef.current?.setTilt(enabled ? 45 : 0);
  };

  return (
    <View style={styles.container}>
      <View ref={mapElement as never} style={styles.map} />
      <MapSearchBox
        query={query}
        onChangeQuery={setQuery}
        localSuggestions={localSuggestions}
        onSelect={(suggestion) => {
          mapRef.current?.panTo({ lat: suggestion.latitude, lng: suggestion.longitude });
          mapRef.current?.setZoom(16);
          if (suggestion.kind === 'center') onSelectCenter?.(suggestion.id.replace(/^center-/, ''));
        }}
        onNavigate={(suggestion) => onNavigationTargetChange?.({ title: suggestion.title, latitude: suggestion.latitude, longitude: suggestion.longitude })}
        placeholder="Search evacuation centers or places"
        accessibilityLabel="Search evacuation centers or places"
      />
      <View style={styles.controls}>
        <Pressable onPress={recenter} style={styles.control} accessibilityRole="button" accessibilityLabel="Recenter map">
          <MaterialCommunityIcons name="crosshairs-gps" size={20} color={Colors.primary} />
        </Pressable>
        <Pressable onPress={toggle3d} style={styles.control} accessibilityRole="button" accessibilityLabel="Toggle 3D map">
          <Text style={styles.controlLabel}>{show3d ? '2D' : '3D'}</Text>
        </Pressable>
      </View>
      {navigationTarget && <MapNavigation target={navigationTarget} onClose={() => onNavigationTargetChange?.(null)} />}
      {locationError ? <View style={styles.errorBanner}><Text style={styles.errorText}>{locationError}</Text></View> : null}
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
  controls: { position: 'absolute', right: 12, bottom: 20, gap: 8 },
  control: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: Colors.white, elevation: 4 },
  controlLabel: { color: Colors.primary, fontSize: 13, fontWeight: '800' },
  errorBanner: { position: 'absolute', bottom: 12, left: 12, right: 70, padding: 10, borderRadius: 8, backgroundColor: '#FCE8E6' },
  errorText: { color: '#A52D2D', fontSize: 12 },
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
