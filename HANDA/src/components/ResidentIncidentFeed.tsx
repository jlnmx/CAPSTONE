import React, { useCallback, useState } from 'react';
import { Colors } from '@constants/colors';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { authenticatedFetch } from '@services/apiClient';
import { incidentStatusColor, incidentStatusLabel } from '@constants/incidentStatus';

type ResidentIncident = {
  id: string;
  type: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  photoUris: string[];
  status: string;
  createdAt: string;
  responseEtaMinutes?: number;
  responseOrganizations: string;
};

const GREEN = '#218B25';

function normalizeIncident(record: Record<string, unknown>): ResidentIncident {
  const rawPhotos = record.photoUris ?? record.photo_uris;
  const rawEta = record.responseEtaMinutes ?? record.response_eta_minutes;
  return {
    id: String(record.id), type: String(record.type ?? 'Incident'), description: String(record.description ?? ''), location: String(record.location ?? record.location_text ?? 'Location not provided'), latitude: record.latitude == null ? undefined : Number(record.latitude), longitude: record.longitude == null ? undefined : Number(record.longitude), photoUris: Array.isArray(rawPhotos) ? rawPhotos.map(String) : [], status: String(record.status ?? 'reported'), createdAt: String(record.createdAt ?? record.created_at ?? ''),
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

  useFocusEffect(useCallback(() => {
    void load();
    const refresh = setInterval(() => void load(), 15000);
    return () => clearInterval(refresh);
  }, [load]));

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void load(true)} tintColor={GREEN} />}>
      <View style={styles.heading}><View><Text style={styles.eyebrow}>COMMUNITY WATCH</Text><Text style={styles.title}>Current incidents</Text><Text style={styles.subtitle}>Live reports from residents and responders around Biñan City.</Text></View><MaterialCommunityIcons name="radar" size={28} color={GREEN} /></View>
      {isLoading && <ActivityIndicator color={GREEN} style={styles.loader} />}
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!isLoading && !error && incidents.length === 0 && <View style={styles.empty}><MaterialCommunityIcons name="shield-check-outline" size={34} color={GREEN} /><Text style={styles.emptyTitle}>No active incidents</Text><Text style={styles.emptyText}>New community reports will appear here as they are posted.</Text></View>}
      {incidents.map((incident) => <View style={styles.card} key={incident.id}>
        <View style={styles.cardHeader}><View style={[styles.icon, { backgroundColor: `${incidentStatusColor(incident.status)}1F` }]}><MaterialCommunityIcons name="alert-outline" size={21} color={incidentStatusColor(incident.status)} /></View><View style={styles.cardCopy}><Text style={styles.cardTitle}>{incident.type}</Text><Text style={[styles.status, { color: incidentStatusColor(incident.status) }]}>{incidentStatusLabel(incident.status).toUpperCase()}</Text></View><Text style={styles.time}>{formatTime(incident.createdAt)}</Text></View>
        {(incident.status === 'acknowledged' || incident.status === 'in_progress') && <Text style={[styles.responding, { color: incidentStatusColor(incident.status) }]}>Responders are on the way{incident.responseEtaMinutes != null ? ` · ETA ${incident.responseEtaMinutes} min` : ''}{incident.responseOrganizations ? ` · ${incident.responseOrganizations}` : ''}</Text>}
        <View style={styles.location}>
          <View style={styles.locationIcon}><MaterialCommunityIcons name="map-marker-radius-outline" size={18} color={GREEN} /></View>
          <View style={styles.locationCopy}>
            <Text style={styles.locationLabel}>INCIDENT LOCATION</Text>
            <Text style={styles.locationText}>{displayLocationLabel(incident.location, incident.latitude, incident.longitude)}</Text>
            {incident.latitude != null && incident.longitude != null && Number.isFinite(incident.latitude) && Number.isFinite(incident.longitude) && <Text style={styles.coordinates}>GPS {incident.latitude.toFixed(6)}, {incident.longitude.toFixed(6)}</Text>}
          </View>
        </View>
        <Text style={styles.description}>{incident.description}</Text>
        {incident.photoUris.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photos}>{incident.photoUris.map((uri, index) => <Image key={`${incident.id}-photo-${index}`} source={{ uri }} style={styles.photo} />)}</ScrollView>}
      </View>)}
    </ScrollView>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  content: { padding: 14, paddingBottom: 22, backgroundColor: Colors.background }, heading: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }, eyebrow: { color: GREEN, fontSize: 9, fontWeight: '800', letterSpacing: 1 }, title: { color: Colors.text, fontSize: 22, fontWeight: '800', marginTop: 3 }, subtitle: { maxWidth: 290, color: Colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 4 }, loader: { marginVertical: 24 }, error: { color: '#B42318', fontSize: 12, lineHeight: 17, paddingVertical: 12 }, empty: { alignItems: 'center', paddingVertical: 45, paddingHorizontal: 30, borderWidth: 1, borderColor: Colors.border, borderRadius: 9, backgroundColor: Colors.surface }, emptyTitle: { color: Colors.text, fontSize: 15, fontWeight: '800', marginTop: 9 }, emptyText: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 5 }, card: { padding: 12, marginBottom: 10, borderWidth: 1, borderColor: Colors.border, borderRadius: 9, backgroundColor: Colors.surface }, cardHeader: { flexDirection: 'row', alignItems: 'center' }, icon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 }, cardCopy: { flex: 1, marginLeft: 9 }, cardTitle: { color: Colors.text, fontSize: 13, fontWeight: '800' }, status: { color: Colors.textMuted, fontSize: 9, fontWeight: '800', marginTop: 3, textTransform: 'uppercase' }, responding: { fontSize: 11, fontWeight: '700', lineHeight: 16, marginTop: 8 }, time: { color: Colors.textMuted, fontSize: 10 }, location: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10, padding: 9, borderWidth: 1, borderColor: '#C9DCC9', borderRadius: 6, backgroundColor: '#F2F7F1' }, locationIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#E1EFE0' }, locationCopy: { flex: 1, minWidth: 0 }, locationLabel: { color: GREEN, fontSize: 9, fontWeight: '800', letterSpacing: 0.4 }, locationText: { color: Colors.text, fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 2 }, coordinates: { color: Colors.textMuted, fontSize: 10, lineHeight: 14, marginTop: 2 }, description: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 7 }, photos: { marginTop: 10 }, photo: { width: 82, height: 82, marginRight: 7, borderRadius: 7, backgroundColor: Colors.surfaceMuted },
});
