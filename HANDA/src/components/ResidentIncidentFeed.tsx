import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PhotoGallery } from '@components/PhotoGallery';
import { Colors } from '@constants/colors';
import { ActivityIndicator, Animated, Easing, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { authenticatedFetch } from '@services/apiClient';
import { useIncidentFeed } from '@hooks/useRealtime';
import { incidentStatusColor } from '@constants/incidentStatus';
import { IncidentTypeBadge, KIT_GREEN as GREEN, ProgressSteps, Reveal, StatusPill, kitFonts } from '@components/IncidentCardKit';

type ResidentIncident = {
  id: string;
  type: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  photoUris: string[];
  responsePhotoUris: string[];
  status: string;
  createdAt: string;
  responseEtaMinutes?: number;
  responseOrganizations: string;
};

function normalizeIncident(record: Record<string, unknown>): ResidentIncident {
  const rawPhotos = record.photoUris ?? record.photo_uris;
  const rawResponsePhotos = record.responsePhotoUris ?? record.response_photo_uris;
  const rawEta = record.responseEtaMinutes ?? record.response_eta_minutes;
  return {
    id: String(record.id), type: String(record.type ?? 'Incident'), description: String(record.description ?? ''), location: String(record.location ?? record.location_text ?? 'Location not provided'), latitude: record.latitude == null ? undefined : Number(record.latitude), longitude: record.longitude == null ? undefined : Number(record.longitude), photoUris: Array.isArray(rawPhotos) ? rawPhotos.map(String) : [], responsePhotoUris: Array.isArray(rawResponsePhotos) ? rawResponsePhotos.map(String) : [], status: String(record.status ?? 'reported'), createdAt: String(record.createdAt ?? record.created_at ?? ''),
    responseEtaMinutes: rawEta == null ? undefined : Number(rawEta), responseOrganizations: String(record.responseOrganizations ?? record.response_organizations ?? ''),
  };
}

function displayLocationLabel(location: string, latitude?: number, longitude?: number): string {
  const label = location.replace(/\s*[·,]\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/, '').trim();
  if (label && !['location not provided', 'location unavailable'].includes(label.toLowerCase())) return label;
  return latitude != null && longitude != null ? 'Pinned incident location' : 'Location unavailable';
}

export default function ResidentIncidentFeed() {
  const [incidents, setIncidents] = useState<ResidentIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    try {
      const response = await authenticatedFetch('/api/v1/incidents');
      if (!response.ok) throw new Error('Incident service unavailable.');
      const records = await response.json() as Array<Record<string, unknown>>;
      setIncidents(records.map(normalizeIncident).filter((incident) => incident.status !== 'resolved'));
      setError('');
    } catch {
      setError('Live incidents could not be loaded. Check your connection and try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useIncidentFeed(() => void load());

  useFocusEffect(useCallback(() => {
    void load();
    const refresh = setInterval(() => void load(), 15000);
    return () => clearInterval(refresh);
  }, [load]));

  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void load(true)} tintColor={GREEN} />}>
      <Reveal index={0}>
        <View style={styles.heading}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>COMMUNITY WATCH</Text>
            <Text style={styles.title}>Current incidents</Text>
            <Text style={styles.subtitle}>Live reports from residents and responders around Biñan City.</Text>
          </View>
          <View style={styles.radar}>
            <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}><MaterialCommunityIcons name="radar" size={30} color={GREEN} /></Animated.View>
          </View>
        </View>
      </Reveal>
      {isLoading && <ActivityIndicator color={GREEN} style={styles.loader} />}
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!isLoading && !error && incidents.length === 0 && <Reveal index={1}><View style={styles.empty}><View style={styles.emptyIcon}><MaterialCommunityIcons name="shield-check-outline" size={34} color={GREEN} /></View><Text style={styles.emptyTitle}>No active incidents</Text><Text style={styles.emptyText}>New community reports will appear here as they are posted.</Text></View></Reveal>}
      {incidents.map((incident, index) => {
        const color = incidentStatusColor(incident.status);
        const hasResponders = incident.status === 'acknowledged' || incident.status === 'in_progress';
        return <Reveal index={index + 1} key={incident.id}>
          <View style={styles.card}>
            <View style={[styles.accent, { backgroundColor: color }]} />
            <View style={styles.cardHeader}>
              <IncidentTypeBadge type={incident.type} status={incident.status} />
              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle} numberOfLines={1}>{incident.type}</Text>
                <View style={styles.metaRow}><MaterialCommunityIcons name="clock-outline" size={12} color={Colors.textMuted} /><Text style={styles.time}>{formatTime(incident.createdAt)}</Text></View>
              </View>
              <StatusPill status={incident.status} />
            </View>
            {hasResponders && <View style={[styles.responding, { backgroundColor: `${color}12`, borderColor: `${color}30` }]}>
              <MaterialCommunityIcons name="run-fast" size={16} color={color} />
              <Text style={[styles.respondingText, { color }]}>Responders are on the way{incident.responseEtaMinutes != null ? ` · ETA ${incident.responseEtaMinutes} min` : ''}{incident.responseOrganizations ? ` · ${incident.responseOrganizations}` : ''}</Text>
            </View>}
            <View style={styles.location}>
              <View style={styles.locationIcon}><MaterialCommunityIcons name="map-marker-radius-outline" size={18} color={GREEN} /></View>
              <View style={styles.locationCopy}>
                <Text style={styles.locationLabel}>INCIDENT LOCATION</Text>
                <Text style={styles.locationText}>{displayLocationLabel(incident.location, incident.latitude, incident.longitude)}</Text>
                {incident.latitude != null && incident.longitude != null && Number.isFinite(incident.latitude) && Number.isFinite(incident.longitude) && <Text style={styles.coordinates}>GPS {incident.latitude.toFixed(6)}, {incident.longitude.toFixed(6)}</Text>}
              </View>
            </View>
            {!!incident.description && <Text style={styles.description}>{incident.description}</Text>}
            <ProgressSteps status={incident.status} />
            {incident.photoUris.length > 0 && <><Text style={styles.photoLabel}>REPORTED PHOTOS</Text><PhotoGallery uris={incident.photoUris} style={styles.photos} thumbnailStyle={styles.photo} /></>}
            {incident.responsePhotoUris.length > 0 && <><Text style={styles.photoLabel}>RESPONDER SCENE PHOTOS</Text><PhotoGallery uris={incident.responsePhotoUris} style={styles.photos} thumbnailStyle={styles.photo} /></>}
          </View>
        </Reveal>;
      })}
    </ScrollView>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  content: { padding: 14, paddingBottom: 26, backgroundColor: Colors.background },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headingCopy: { flex: 1, paddingRight: 10 },
  eyebrow: { color: GREEN, fontFamily: kitFonts.bold, fontSize: 10, letterSpacing: 1.6 },
  title: { color: Colors.text, fontFamily: kitFonts.heading, fontSize: 23, marginTop: 3 },
  subtitle: { maxWidth: 300, color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 12, lineHeight: 17, marginTop: 4 },
  radar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E4F1E4', borderWidth: 1, borderColor: '#BFDDBF' },
  loader: { marginVertical: 24 },
  error: { color: '#B42318', fontFamily: kitFonts.medium, fontSize: 12, lineHeight: 17, paddingVertical: 12 },
  empty: { alignItems: 'center', paddingVertical: 45, paddingHorizontal: 30, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, backgroundColor: Colors.surface },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E4F1E4' },
  emptyTitle: { color: Colors.text, fontFamily: kitFonts.heading, fontSize: 16, marginTop: 12 },
  emptyText: { color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 5 },
  card: { padding: 14, paddingLeft: 18, marginBottom: 14, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, overflow: 'hidden', backgroundColor: Colors.surface, shadowColor: '#103A18', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.09, shadowRadius: 14, elevation: 3 },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { color: Colors.text, fontFamily: kitFonts.heading, fontSize: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  time: { color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 11 },
  responding: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  respondingText: { flex: 1, fontFamily: kitFonts.semibold, fontSize: 11, lineHeight: 16 },
  location: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12, padding: 10, borderRadius: 14, backgroundColor: '#F2F7F1' },
  locationIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#E1EFE0' },
  locationCopy: { flex: 1, minWidth: 0 },
  locationLabel: { color: GREEN, fontFamily: kitFonts.bold, fontSize: 9, letterSpacing: 0.8 },
  locationText: { color: Colors.text, fontFamily: kitFonts.semibold, fontSize: 13, lineHeight: 18, marginTop: 2 },
  coordinates: { color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 10, lineHeight: 14, marginTop: 2 },
  description: { color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 12, lineHeight: 18, marginTop: 10 },
  photoLabel: { color: GREEN, fontFamily: kitFonts.bold, fontSize: 9, letterSpacing: 0.8, marginTop: 12 },
  photos: { marginTop: 6 },
  photo: { width: 82, height: 82, marginRight: 7, borderRadius: 12, backgroundColor: Colors.surfaceMuted },
});
