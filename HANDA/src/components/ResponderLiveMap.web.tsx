import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';
import { useAuth } from '@hooks/useAuth';
import { useEvacuationCenterFeed, useIncidentFeed, useResponderLive } from '@hooks/useRealtime';
import { getIncidentResponders, getResponderData, ResponderDataSnapshot } from '@services/responderData';
import useMapConnectivity from '@services/map/useMapConnectivity';
import { loadGoogleMapsApi } from '@services/map/googleMapsWeb';
import OfflineMapCanvas from './OfflineMapCanvas';
import type { OfflineMapPoint } from './OfflineMapCanvas';

const CENTER = { lat: 14.3036, lng: 121.0781 };
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY ?? '';
const EMPTY_DATA: ResponderDataSnapshot = { incidents: [], evacuees: [], registeredEvacuees: 0, disasters: [], centers: [], unavailableSources: [] };

export default function ResponderLiveMap() {
  const { user } = useAuth();
  const isOnline = useMapConnectivity();
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [show3d, setShow3d] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const { responders } = useResponderLive();

  const loadData = useCallback(async () => {
    try {
      const [snapshot, crew] = await Promise.all([getResponderData(), getIncidentResponders()]);
      const incidents = user?.role === 'responder'
        ? snapshot.incidents.filter((incident) => crew[incident.id]?.some((responder) => responder.id === user.id))
        : snapshot.incidents;
      setData({ ...snapshot, incidents });
      setError(snapshot.unavailableSources.length ? 'Some live map information could not be refreshed.' : '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Map data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role]);
  useIncidentFeed(() => void loadData());
  useEvacuationCenterFeed(() => void loadData());

  useEffect(() => {
    void loadData();
    const timer = window.setInterval(() => void loadData(), 15_000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  useEffect(() => {
    if (isOnline === null || !isOnline || !mapElement.current) return undefined;
    let active = true;
    void loadGoogleMapsApi().then(() => {
      if (!active || !mapElement.current) return;
      const map = new google.maps.Map(mapElement.current, {
        center: CENTER,
        zoom: 13,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        streetViewControl: false,
        fullscreenControl: false,
        tilt: 0,
      });
      mapRef.current = map;
      setMapReady(true);
    }).catch((mapError: unknown) => {
      if (active) setLoadError(mapError instanceof Error ? mapError.message : 'Google Maps could not be loaded.');
    });
    return () => {
      active = false;
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      mapRef.current = null;
      setMapReady(false);
    };
  }, [isOnline]);

  const searchItems = useMemo(() => [
    ...data.centers.flatMap((center) => center.latitude == null || center.longitude == null
      ? []
      : [{ name: center.name, description: center.location, latitude: center.latitude, longitude: center.longitude }]),
    ...data.incidents.flatMap((incident) => incident.latitude == null || incident.longitude == null || incident.status === 'resolved'
      ? []
      : [{ name: incident.type, description: incident.location, latitude: incident.latitude, longitude: incident.longitude }]),
  ], [data]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    markersRef.current.forEach((marker) => marker.setMap(null));
    const markers: google.maps.Marker[] = [];

    data.centers.forEach((center) => {
      if (center.latitude == null || center.longitude == null) return;
      const marker = new google.maps.Marker({
        map,
        position: { lat: center.latitude, lng: center.longitude },
        title: center.name,
        icon: center.status === 'closed' || center.status === 'full'
          ? undefined
          : { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#218B25', fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 2 },
      });
      const info = new google.maps.InfoWindow({
        content: `<strong>${escapeHtml(center.name)}</strong><br>${escapeHtml(center.location)} · ${center.currentOccupancy}/${center.capacity}<br><button type="button">Directions</button>`,
      });
      marker.addListener('click', () => info.open({ map, anchor: marker }));
      info.addListener('domready', () => {
        const button = document.querySelector('.gm-style-iw button[type="button"]');
        button?.addEventListener('click', () => openDirections(center.latitude!, center.longitude!), { once: true });
      });
      markers.push(marker);
    });

    data.incidents.forEach((incident) => {
      if (incident.latitude == null || incident.longitude == null || incident.status === 'resolved') return;
      const marker = new google.maps.Marker({
        map,
        position: { lat: incident.latitude, lng: incident.longitude },
        title: incident.type,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: incident.status === 'reported' ? '#D83B36' : '#F28C28', fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 2 },
      });
      const info = new google.maps.InfoWindow({
        content: `<strong>${escapeHtml(incident.type)}</strong><br>${escapeHtml(incident.status.replace(/_/g, ' '))} · ${escapeHtml(incident.location)}<br><button type="button">Directions</button>`,
      });
      marker.addListener('click', () => info.open({ map, anchor: marker }));
      info.addListener('domready', () => {
        const button = document.querySelector('.gm-style-iw button[type="button"]');
        button?.addEventListener('click', () => openDirections(incident.latitude!, incident.longitude!), { once: true });
      });
      markers.push(marker);
    });

    Object.values(responders).forEach((responder) => {
      if (!responder.location || responder.user_id === user?.id) return;
      const { latitude, longitude } = responder.location;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      markers.push(new google.maps.Marker({
        map,
        position: { lat: latitude, lng: longitude },
        title: `Responder · ${responder.availability}`,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: '#1769AA', fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 2 },
      }));
    });
    markersRef.current = markers;
  }, [data, responders, mapReady, user?.id]);

  if (isOnline === null) return <MapState label="Checking map connectivity..." />;
  if (!isOnline && loading) return <MapState label="Loading saved map locations..." />;
  if (!isOnline) return <OfflineMapCanvas points={toOfflinePoints(data)} />;
  if (!API_KEY) return <MapState label="Google Maps is not configured. Add EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY to the app web environment." />;
  if (loadError) return <MapState label={loadError} />;

  const search = async () => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return;
    const match = searchItems.find((item) => `${item.name} ${item.description}`.toLocaleLowerCase().includes(term));
    if (match) {
      mapRef.current?.panTo({ lat: match.latitude, lng: match.longitude });
      mapRef.current?.setZoom(16);
      return;
    }
    try {
      setLoadError('');
      const places = await google.maps.importLibrary('places') as google.maps.PlacesLibrary;
      const result = await places.Place.searchByText({
        textQuery: query.trim(),
        fields: ['location', 'displayName'],
        maxResultCount: 1,
      });
      const location = result.places[0]?.location;
      if (!location) {
        setLoadError('No matching place was found. Check the search text or try a nearby landmark.');
        return;
      }
      mapRef.current?.panTo(location);
      mapRef.current?.setZoom(16);
    } catch (searchError) {
      setLoadError(searchError instanceof Error ? searchError.message : 'Places search failed. Check the Places API configuration and try again.');
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
    mapRef.current?.setMapTypeId(enabled ? google.maps.MapTypeId.SATELLITE : google.maps.MapTypeId.ROADMAP);
    mapRef.current?.setTilt(enabled ? 45 : 0);
  };

  return (
    <View style={styles.container}>
      <View ref={mapElement as never} style={styles.map} />
      <View style={styles.searchBar}>
        <TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => void search()} placeholder="Search incidents, centers, or places" placeholderTextColor={Colors.textMuted} returnKeyType="search" accessibilityLabel="Search map" style={styles.searchInput} />
        <Pressable onPress={() => void search()} accessibilityRole="button" accessibilityLabel="Search map"><MaterialCommunityIcons name="magnify" size={23} color={Colors.primary} /></Pressable>
      </View>
      <View style={styles.controls}>
        <Pressable onPress={recenter} style={styles.control} accessibilityRole="button" accessibilityLabel="Recenter map"><MaterialCommunityIcons name="crosshairs-gps" size={20} color={Colors.primary} /></Pressable>
        <Pressable onPress={toggle3d} style={styles.control} accessibilityRole="button" accessibilityLabel="Toggle 3D map"><Text style={styles.controlLabel}>{show3d ? '2D' : '3D'}</Text></Pressable>
      </View>
      {(loading || error) && <View style={styles.status}><Text style={styles.statusText}>{loading ? 'Loading live map data...' : error}</Text></View>}
    </View>
  );
}

function openDirections(latitude: number, longitude: number) {
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`, '_blank', 'noopener,noreferrer');
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character] ?? character));
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
  searchInput: { flex: 1, color: Colors.text, fontSize: 13, paddingVertical: 10 },
  controls: { position: 'absolute', right: 12, bottom: 20, gap: 8 },
  control: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: Colors.white, elevation: 4 },
  controlLabel: { color: Colors.primary, fontSize: 13, fontWeight: '800' },
  status: { position: 'absolute', left: 10, bottom: 10, maxWidth: '75%', padding: 8, borderRadius: 6, backgroundColor: Colors.white, elevation: 3 },
  statusText: { color: Colors.textMuted, fontSize: 11 },
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
    ...data.incidents.flatMap((incident) => incident.latitude == null || incident.longitude == null || incident.status === 'resolved'
      ? []
      : [{
        id: `incident-${incident.id}`,
        title: incident.type,
        description: `${incident.status.replace(/_/g, ' ')} · ${incident.location}`,
        latitude: incident.latitude,
        longitude: incident.longitude,
        color: incident.status === 'reported' ? '#D83B36' : '#F28C2C',
      }]),
  ];
}
