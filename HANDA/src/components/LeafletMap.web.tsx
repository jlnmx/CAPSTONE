import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';
import type { MapEvacuationCenter } from '@/types/index';
import useMapConnectivity from '@services/map/useMapConnectivity';
import { loadGoogleMapsApi } from '@services/map/googleMapsWeb';
import { searchMapPlaces } from '@services/map/googleMaps';
import OfflineMapCanvas from './OfflineMapCanvas';
import type { OfflineMapPoint } from './OfflineMapCanvas';
import MapNavigation from './MapNavigation';
import type { MapNavigationTarget } from './MapNavigation.types';

const BINAN = { lat: 14.3036, lng: 121.0781 };

interface LeafletMapProps {
  centers?: MapEvacuationCenter[];
  onSelectCenter?: (centerId: string) => void;
}

export default function LeafletMap({ centers = [], onSelectCenter }: LeafletMapProps) {
  const isOnline = useMapConnectivity();
  const mapElement = useRef<HTMLDivElement | null>(null);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [show3d, setShow3d] = useState(false);
  const [navigationTarget, setNavigationTarget] = useState<MapNavigationTarget | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const validCenters = useMemo(() => centers.filter((center) => (
    center.latitude != null && center.longitude != null
      && Number.isFinite(Number(center.latitude)) && Number.isFinite(Number(center.longitude))
  )), [centers]);

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

      markersRef.current = validCenters.map((center) => {
        const marker = new google.maps.Marker({
          map,
          position: { lat: Number(center.latitude), lng: Number(center.longitude) },
          title: center.name,
          icon: center.status === 'closed' || center.status === 'full'
            ? undefined
            : { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#218B25', fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 2 },
        });
        const content = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = center.name;
        const description = document.createElement('div');
        description.textContent = center.location || 'Evacuation center';
        const navigateButton = document.createElement('button');
        navigateButton.type = 'button';
        navigateButton.textContent = 'Navigate in app';
        navigateButton.addEventListener('click', () => setNavigationTarget({
          title: center.name,
          latitude: Number(center.latitude),
          longitude: Number(center.longitude),
        }));
        content.append(title, description, navigateButton);
        const info = new google.maps.InfoWindow({ content });
        marker.addListener('click', () => {
          info.open({ map, anchor: marker });
          onSelectCenter?.(center.id);
        });
        return marker;
      });

    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : 'Google Maps could not be loaded.');
    });

    return () => {
      active = false;
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      mapRef.current = null;
    };
  }, [isOnline, validCenters, onSelectCenter]);

  if (isOnline === null) return <MapState label="Checking map connectivity..." />;
  if (!isOnline) return <OfflineMapCanvas points={toOfflinePoints(centers)} onSelect={onSelectCenter} />;
  if (loadError) return <MapState label={loadError} />;

  const searchCenters = async () => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return;
    const center = validCenters.find((item) => normalized.split(/\s+/).every((word) => `${item.name} ${item.location}`.toLocaleLowerCase().includes(word)));
    if (center) {
      mapRef.current?.panTo({ lat: Number(center.latitude), lng: Number(center.longitude) });
      mapRef.current?.setZoom(16);
      onSelectCenter?.(center.id);
      return;
    }
    try {
      setLoadError('');
      const [place] = await searchMapPlaces(query.trim());
      if (!place) {
        setLoadError('No matching place was found. Check the search text or try a nearby landmark.');
        return;
      }
      mapRef.current?.panTo({ lat: place.latitude, lng: place.longitude });
      mapRef.current?.setZoom(16);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Places search failed. Check the Places API configuration and try again.');
    }
  };

  const recenter = () => {
    if (!navigator.geolocation) {
      setLoadError('Location access is unavailable in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        mapRef.current?.panTo({ lat: coords.latitude, lng: coords.longitude });
        mapRef.current?.setZoom(16);
      },
      () => setLoadError('Could not access your location. Allow location access in browser settings and retry.'),
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
      <View style={styles.searchBar}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void searchCenters()}
          placeholder="Search centers or places"
          placeholderTextColor={Colors.textMuted}
          returnKeyType="search"
          accessibilityLabel="Search evacuation centers or places"
          style={styles.searchInput}
        />
        <Pressable onPress={() => void searchCenters()} accessibilityRole="button" accessibilityLabel="Search map">
          <MaterialCommunityIcons name="magnify" size={23} color={Colors.primary} />
        </Pressable>
      </View>
      <View style={styles.controls}>
        <Pressable onPress={recenter} style={styles.control} accessibilityRole="button" accessibilityLabel="Recenter map">
          <MaterialCommunityIcons name="crosshairs-gps" size={20} color={Colors.primary} />
        </Pressable>
        <Pressable onPress={toggle3d} style={styles.control} accessibilityRole="button" accessibilityLabel="Toggle 3D map">
          <Text style={styles.controlLabel}>{show3d ? '2D' : '3D'}</Text>
        </Pressable>
      </View>
      {navigationTarget && <MapNavigation target={navigationTarget} onClose={() => setNavigationTarget(null)} />}
      {loadError ? <View style={styles.errorBanner}><Text style={styles.errorText}>{loadError}</Text></View> : null}
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
  searchBar: { position: 'absolute', top: 12, left: 12, right: 12, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: Colors.white, elevation: 4 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14, paddingVertical: 10 },
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
