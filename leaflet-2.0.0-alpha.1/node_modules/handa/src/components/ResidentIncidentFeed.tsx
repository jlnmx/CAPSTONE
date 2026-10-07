import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { authenticatedFetch } from '@services/apiClient';

type ResidentIncident = {
  id: string;
  type: string;
  description: string;
  severity: string;
  location: string;
  latitude?: number;
  longitude?: number;
  photoUris: string[];
  status: string;
  createdAt: string;
};

const GREEN = '#218B25';

function normalizeIncident(record: Record<string, unknown>): ResidentIncident {
  const rawPhotos = record.photoUris ?? record.photo_uris;
  return {
    id: String(record.id), type: String(record.type ?? 'Incident'), description: String(record.description ?? ''), severity: String(record.severity ?? 'medium'), location: String(record.location ?? record.location_text ?? 'Location not provided'), latitude: record.latitude == null ? undefined : Number(record.latitude), longitude: record.longitude == null ? undefined : Number(record.longitude), photoUris: Array.isArray(rawPhotos) ? rawPhotos.map(String) : [], status: String(record.status ?? 'reported'), createdAt: String(record.createdAt ?? record.created_at ?? ''),
  };
}

function severityColor(severity: string) {
  if (severity === 'critical' || severity === 'high') return '#B42318';
  if (severity === 'medium') return '#B36E00';
  return '#2873A8';
}

export default function ResidentIncidentFeed() {
  const [incidents, setIncidents] = useState<ResidentIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = async (refresh = false) => {
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
  };

  useEffect(() => {
    void load();
    const refresh = setInterval(() => void load(), 15000);
    return () => clearInterval(refresh);
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void load(true)} tintColor={GREEN} />}>
      <View style={styles.heading}><View><Text style={styles.eyebrow}>COMMUNITY WATCH</Text><Text style={styles.title}>Current incidents</Text><Text style={styles.subtitle}>Live reports from residents and responders around Biñan City.</Text></View><MaterialCommunityIcons name="radar" size={28} color={GREEN} /></View>
      {isLoading && <ActivityIndicator color={GREEN} style={styles.loader} />}
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!isLoading && !error && incidents.length === 0 && <View style={styles.empty}><MaterialCommunityIcons name="shield-check-outline" size={34} color={GREEN} /><Text style={styles.emptyTitle}>No active incidents</Text><Text style={styles.emptyText}>New community reports will appear here as they are posted.</Text></View>}
      {incidents.map((incident) => <View style={styles.card} key={incident.id}>
        <View style={styles.cardHeader}><View style={[styles.icon, { backgroundColor: `${severityColor(incident.severity)}18` }]}><MaterialCommunityIcons name="alert-outline" size={21} color={severityColor(incident.severity)} /></View><View style={styles.cardCopy}><Text style={styles.cardTitle}>{incident.type}</Text><Text style={[styles.severity, { color: severityColor(incident.severity) }]}>{incident.severity.toUpperCase()} · {incident.status.replace('_', ' ')}</Text></View><Text style={styles.time}>{formatTime(incident.createdAt)}</Text></View>
        <View style={styles.location}><MaterialCommunityIcons name="map-marker-outline" size={15} color={GREEN} /><Text style={styles.locationText}>{incident.location}</Text></View>
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
  content: { padding: 14, paddingBottom: 22, backgroundColor: '#F7FAF7' }, heading: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }, eyebrow: { color: GREEN, fontSize: 9, fontWeight: '800', letterSpacing: 1 }, title: { color: '#17212B', fontSize: 22, fontWeight: '800', marginTop: 3 }, subtitle: { maxWidth: 290, color: '#667085', fontSize: 11, lineHeight: 16, marginTop: 4 }, loader: { marginVertical: 24 }, error: { color: '#B42318', fontSize: 12, lineHeight: 17, paddingVertical: 12 }, empty: { alignItems: 'center', paddingVertical: 45, paddingHorizontal: 30, borderWidth: 1, borderColor: '#DFEADF', borderRadius: 9, backgroundColor: '#FFFFFF' }, emptyTitle: { color: '#17212B', fontSize: 15, fontWeight: '800', marginTop: 9 }, emptyText: { color: '#667085', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 5 }, card: { padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#DFEADF', borderRadius: 9, backgroundColor: '#FFFFFF' }, cardHeader: { flexDirection: 'row', alignItems: 'center' }, icon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 }, cardCopy: { flex: 1, marginLeft: 9 }, cardTitle: { color: '#17212B', fontSize: 13, fontWeight: '800' }, severity: { fontSize: 9, fontWeight: '800', marginTop: 3 }, time: { color: '#8A8F98', fontSize: 10 }, location: { flexDirection: 'row', alignItems: 'center', marginTop: 10 }, locationText: { flex: 1, color: '#4B6350', fontSize: 11, marginLeft: 4 }, description: { color: '#667085', fontSize: 12, lineHeight: 18, marginTop: 7 }, photos: { marginTop: 10 }, photo: { width: 82, height: 82, marginRight: 7, borderRadius: 7, backgroundColor: '#E5EFE8' },
});
