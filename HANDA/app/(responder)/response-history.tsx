import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import AppBackArrow from '@components/AppBackArrow';
import { PhotoGallery } from '@components/PhotoGallery';
import { Colors } from '@constants/colors';
import { incidentStatusColor, incidentStatusLabel } from '@constants/incidentStatus';
import { getResponseHistory, ResponseHistoryEntry } from '@services/responderData';

const GREEN = '#218B25';

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function locationLabel(entry: ResponseHistoryEntry): string {
  if (entry.location) return entry.location;
  if (entry.latitude != null && entry.longitude != null) return `${entry.latitude.toFixed(6)}, ${entry.longitude.toFixed(6)}`;
  return 'Location not provided';
}

export default function ResponseHistoryScreen() {
  const [entries, setEntries] = useState<ResponseHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setEntries(await getResponseHistory());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} />} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBand}>
          <AppBackArrow />
          <View>
            <Text style={styles.title}>RESPONSE</Text>
            <Text style={styles.title}>HISTORY</Text>
          </View>
        </View>
        <View style={styles.body}>
          {isLoading && <Text style={styles.empty}>Loading your response history...</Text>}
          {!isLoading && failed && entries.length === 0 && <Text style={styles.empty}>Your response history could not be loaded. Check your connection and pull down to retry.</Text>}
          {!isLoading && !failed && entries.length === 0 && <Text style={styles.empty}>You have not responded to any incidents yet.</Text>}
          {entries.map((entry) => (
            <View key={entry.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.icon}><MaterialCommunityIcons name="alert-outline" size={20} color={incidentStatusColor(entry.status)} /></View>
                <View style={styles.copy}>
                  <Text style={styles.name}>{entry.type}</Text>
                  <Text style={styles.meta}>Reported {formatDateTime(entry.createdAt)}</Text>
                </View>
                <Text style={[styles.status, { color: incidentStatusColor(entry.status) }]}>{incidentStatusLabel(entry.status)}</Text>
              </View>

              <Text style={styles.label}>LOCATION</Text>
              <View style={styles.row}>
                <MaterialCommunityIcons name="map-marker-radius-outline" size={16} color={GREEN} />
                <Text style={styles.value}>{locationLabel(entry)}</Text>
              </View>

              <Text style={styles.label}>TIMELINE</Text>
              {entry.timeline.length === 0 && <Text style={styles.meta}>No timeline recorded.</Text>}
              {entry.timeline.map((event, index) => (
                <View key={`${event.status}-${event.at}-${index}`} style={styles.timelineRow}>
                  <View style={[styles.dot, { backgroundColor: incidentStatusColor(event.status) }]} />
                  <Text style={styles.timelineStatus}>{incidentStatusLabel(event.status)}</Text>
                  <Text style={styles.timelineTime}>{formatDateTime(event.at)}</Text>
                </View>
              ))}

              {entry.description ? <><Text style={styles.label}>INCIDENT DETAILS</Text><Text style={styles.value}>{entry.description}</Text></> : null}
              {entry.responseEtaMinutes != null && <Text style={styles.meta}>ETA given: {entry.responseEtaMinutes} min</Text>}
              {entry.responseOrganizations ? <Text style={styles.meta}>Organizations: {entry.responseOrganizations}</Text> : null}
              {entry.responseNotes ? <><Text style={styles.label}>RESPONSE NOTES</Text><Text style={styles.value}>{entry.responseNotes}</Text></> : null}
              {entry.photoUris.length > 0 && <><Text style={styles.label}>SCENE PHOTOS</Text><PhotoGallery uris={entry.photoUris} style={styles.photos} thumbnailStyle={styles.photo} /></>}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: 110 },
  titleBand: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: GREEN, paddingHorizontal: 14, paddingTop: 18, paddingBottom: 9 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', lineHeight: 22 },
  body: { paddingHorizontal: 14, paddingTop: 14 },
  empty: { color: Colors.textMuted, fontSize: 12, paddingVertical: 12 },
  card: { backgroundColor: Colors.surface, borderRadius: 7, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, marginLeft: 9 },
  name: { color: Colors.text, fontSize: 13, fontWeight: '800' },
  meta: { color: Colors.textMuted, fontSize: 11, marginTop: 3 },
  status: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  label: { color: GREEN, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4 },
  value: { flex: 1, color: Colors.text, fontSize: 12, lineHeight: 17, marginTop: 3 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  timelineStatus: { color: Colors.text, fontSize: 12, fontWeight: '700', minWidth: 100 },
  timelineTime: { flex: 1, color: Colors.textMuted, fontSize: 11 },
  photos: { marginTop: 6 },
  photo: { width: 72, height: 72, marginRight: 6, borderRadius: 6, backgroundColor: Colors.surfaceMuted },
});
