import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';
import { incidentStatusColor } from '@constants/incidentStatus';
import { useAuth } from '@hooks/useAuth';
import { useEvacuationCenterFeed, useIncidentFeed, useResponderLive } from '@hooks/useRealtime';
import { getResponderData, ResponderDataSnapshot } from '@services/responderData';
import useMapConnectivity from '@services/map/useMapConnectivity';
import { loadGoogleMapsApi } from '@services/map/googleMapsWeb';
import OfflineMapCanvas from './OfflineMapCanvas';
import type { OfflineMapPoint } from './OfflineMapCanvas';
import MapNavigation from './MapNavigation';
import type { MapNavigationTarget } from './MapNavigation.types';
import MapSearchBox from './MapSearchBox';
import type { MapSearchSuggestion } from './MapSearchBox';

const CENTER = { lat: 14.3036, lng: 121.0781 };
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY ?? '';
const EMPTY_DATA: ResponderDataSnapshot = { incidents: [], evacuees: [], registeredEvacuees: 0, disasters: [], centers: [], unavailableSources: [] };

export default function ResponderLiveMap() {
  const { user } = useAuth();
  const isOnline = useMapConnectivity();
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [query, setQuery] = useState('');
  const [show3d, setShow3d] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [navigationTarget, setNavigationTarget] = useState<MapNavigationTarget | null>(null);
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

  const localSuggestions = useMemo<MapSearchSuggestion[]>(() => [
    ...data.centers.flatMap((center) => center.latitude == null || center.longitude == null
      ? []
      : [{ id: `center-${center.id}`, title: center.name, subtitle: `${center.location} · ${center.status}`, latitude: center.latitude, longitude: center.longitude, kind: 'center' as const }]),
    ...data.incidents.flatMap((incident) => incident.latitude == null || incident.longitude == null
      ? []
      : [{ id: `incident-${incident.id}`, title: incident.type, subtitle: `${incident.status.replace(/_/g, ' ')} · ${incident.location}`, latitude: incident.latitude, longitude: incident.longitude, kind: 'incident' as const }]),
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
      const content = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = center.name;
      const details = document.createElement('div');
      details.textContent = `${center.location} · ${center.currentOccupancy}/${center.capacity}`;
      const navigateButton = document.createElement('button');
      navigateButton.type = 'button';
      navigateButton.textContent = 'Navigate';
      Object.assign(navigateButton.style, { marginTop: '8px', border: '0', borderRadius: '8px', padding: '7px 12px', background: '#218B25', color: '#ffffff', fontWeight: '700', cursor: 'pointer' });
      navigateButton.addEventListener('click', () => setNavigationTarget({
        title: center.name,
        latitude: center.latitude!,
        longitude: center.longitude!,
      }));
      content.append(title, details, navigateButton);
      const info = new google.maps.InfoWindow({ content });
      marker.addListener('click', () => info.open({ map, anchor: marker }));
      markers.push(marker);
    });

    data.incidents.forEach((incident) => {
      if (incident.latitude == null || incident.longitude == null) return;
      const marker = new google.maps.Marker({
        map,
        position: { lat: incident.latitude, lng: incident.longitude },
        title: incident.type,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: incident.status === 'reported' ? 10 : 8, fillColor: incidentStatusColor(incident.status), fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 2 },
      });
      const content = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = incident.type;
      const details = document.createElement('div');
      details.textContent = `${incident.status.replace(/_/g, ' ')} · ${incident.location}`;
      const navigateButton = document.createElement('button');
      navigateButton.type = 'button';
      navigateButton.textContent = 'Navigate';
      Object.assign(navigateButton.style, { marginTop: '8px', border: '0', borderRadius: '8px', padding: '7px 12px', background: '#218B25', color: '#ffffff', fontWeight: '700', cursor: 'pointer' });
      navigateButton.addEventListener('click', () => setNavigationTarget({
        title: incident.type,
        latitude: incident.latitude!,
        longitude: incident.longitude!,
      }));
      content.append(title, details, navigateButton);
      const info = new google.maps.InfoWindow({ content });
      marker.addListener('click', () => info.open({ map, anchor: marker }));
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

  useEffect(() => {
    if (isOnline !== true || !mapReady || !mapRef.current || !navigator.geolocation) return undefined;
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
      } else userMarkerRef.current.setPosition(position);
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
  if (!isOnline && loading) return <MapState label="Loading saved map locations..." />;
  if (!isOnline) return <OfflineMapCanvas points={toOfflinePoints(data)} />;
  if (!API_KEY) return <MapState label="Google Maps is not configured. Add EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY to the app web environment." />;
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
    mapRef.current?.setMapTypeId(enabled ? google.maps.MapTypeId.SATELLITE : google.maps.MapTypeId.ROADMAP);
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
        }}
        onNavigate={(suggestion) => setNavigationTarget({ title: suggestion.title, latitude: suggestion.latitude, longitude: suggestion.longitude })}
        placeholder="Search incidents, centers, or places"
        accessibilityLabel="Search incidents, centers, or places"
      />
      <View style={styles.controls}>
        <Pressable onPress={recenter} style={styles.control} accessibilityRole="button" accessibilityLabel="Recenter map"><MaterialCommunityIcons name="crosshairs-gps" size={20} color={Colors.primary} /></Pressable>
        <Pressable onPress={toggle3d} style={styles.control} accessibilityRole="button" accessibilityLabel="Toggle 3D map"><Text style={styles.controlLabel}>{show3d ? '2D' : '3D'}</Text></Pressable>
      </View>
      {navigationTarget && <MapNavigation target={navigationTarget} onClose={() => setNavigationTarget(null)} />}
      {(loading || error || locationError) && <View style={styles.status}><Text style={styles.statusText}>{loading ? 'Loading live map data...' : error || locationError}</Text></View>}
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
