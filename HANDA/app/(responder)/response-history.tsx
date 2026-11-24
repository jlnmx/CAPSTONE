import { ThemeAwareView, ThemeAwareSafeAreaView, ThemeAwareScrollView } from '@components/ThemeAware';
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText as Text } from '@components/ThemedText';
import AppBackArrow from '@components/AppBackArrow';
import { PhotoGallery } from '@components/PhotoGallery';
import { Colors } from '@constants/colors';
import { incidentStatusColor, incidentStatusLabel } from '@constants/incidentStatus';
import { getResponseHistory, ResponseHistoryEntry } from '@services/responderData';
import { KIT_GREEN as GREEN, Reveal, kitFonts } from '@components/IncidentCardKit';

function formatDateTime(value?: string): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

function incidentDuration(startedAt: string, resolvedAt?: string): string {
  if (!resolvedAt) return 'Not resolved';
  const elapsed = new Date(resolvedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return 'Unavailable';
  const seconds = Math.floor(elapsed / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (days) return `${days}d ${hours}h ${minutes}m`;
  if (hours) return `${hours}h ${minutes}m ${remainingSeconds}s`;
  if (minutes) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
}

function arrivalLocationLabel(entry: ResponseHistoryEntry): string {
  if (entry.arrivalLatitude != null && entry.arrivalLongitude != null) {
    return `GPS ${entry.arrivalLatitude.toFixed(6)}, ${entry.arrivalLongitude.toFixed(6)}`;
  }
  return entry.location || 'Arrival location not recorded';
}

function ResponseMetric({ icon, label, value }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; value: string }) {
  return (
    <ThemeAwareView style={styles.metric}>
      <ThemeAwareView style={styles.metricIcon}><MaterialCommunityIcons name={icon} size={16} color={GREEN} /></ThemeAwareView>
      <ThemeAwareView style={styles.metricCopy}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </ThemeAwareView>
    </ThemeAwareView>
  );
}

export default function ResponseHistoryScreen() {
  const [entries, setEntries] = useState<ResponseHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      setEntries(await getResponseHistory());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <ThemeAwareSafeAreaView style={styles.container}>
      <ThemeAwareScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[Colors.primary, Colors.brandBlueDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.titleBand}>
          <AppBackArrow />
          <ThemeAwareView style={styles.headingCopy}>
            <Text style={styles.eyebrow}>FIELD OPERATIONS</Text>
            <Text style={styles.title}>Response history</Text>
            <Text style={styles.subtitle}>Arrival details, incident timelines, and outcomes</Text>
          </ThemeAwareView>
        </LinearGradient>

        <ThemeAwareView style={styles.body}>
          {!isLoading && failed && entries.length === 0 && <ThemeAwareView style={styles.emptyState}><MaterialCommunityIcons name="alert-circle-outline" size={28} color={Colors.textMuted} /><Text style={styles.emptyTitle}>History unavailable</Text><Text style={styles.empty}>Check your connection and pull down to retry.</Text></ThemeAwareView>}
          {!isLoading && !failed && entries.length === 0 && <ThemeAwareView style={styles.emptyState}><MaterialCommunityIcons name="clipboard-text-clock-outline" size={28} color={Colors.textMuted} /><Text style={styles.emptyTitle}>No responses yet</Text><Text style={styles.empty}>Incidents assigned to you will appear here with their arrival and resolution details.</Text></ThemeAwareView>}
          {isLoading && <Text style={styles.loading}>Loading your response history...</Text>}

          {entries.map((entry, index) => (
            <Reveal index={index} key={entry.id}>
              <ThemeAwareView style={styles.card}>
                <ThemeAwareView style={styles.cardHeader}>
                  <ThemeAwareView style={[styles.incidentIcon, { backgroundColor: `${incidentStatusColor(entry.status)}18` }]}>
                    <MaterialCommunityIcons name="alert-outline" size={21} color={incidentStatusColor(entry.status)} />
                  </ThemeAwareView>
                  <ThemeAwareView style={styles.headerCopy}>
                    <Text style={styles.name}>{entry.type}</Text>
                    <Text style={styles.meta}>Reported {formatDateTime(entry.createdAt)}</Text>
                  </ThemeAwareView>
                  <ThemeAwareView style={[styles.statusPill, { backgroundColor: `${incidentStatusColor(entry.status)}18` }]}>
                    <Text style={[styles.status, { color: incidentStatusColor(entry.status) }]}>{incidentStatusLabel(entry.status)}</Text>
                  </ThemeAwareView>
                </ThemeAwareView>

                <ThemeAwareView style={styles.metrics}>
                  <ResponseMetric icon="timer-outline" label="EXACT TIME OF ARRIVAL" value={formatDateTime(entry.arrivedAt)} />
                  <ResponseMetric icon="map-marker-radius-outline" label="ARRIVAL LOCATION" value={arrivalLocationLabel(entry)} />
                  <ResponseMetric icon="clock-check-outline" label="INCIDENT DURATION" value={incidentDuration(entry.createdAt, entry.resolvedAt)} />
                  <ResponseMetric icon="check-circle-outline" label="RESOLVED AT" value={formatDateTime(entry.resolvedAt)} />
                </ThemeAwareView>

                <ThemeAwareView style={styles.section}>
                  <Text style={styles.sectionTitle}>RESPONSE TIMELINE</Text>
                  {entry.timeline.length === 0 && <Text style={styles.meta}>No timeline recorded.</Text>}
                  {entry.timeline.map((event, eventIndex) => (
                    <ThemeAwareView key={`${event.status}-${event.at}-${eventIndex}`} style={styles.timelineRow}>
                      <ThemeAwareView style={styles.timelineMarker}>
                        <ThemeAwareView style={[styles.dot, { backgroundColor: incidentStatusColor(event.status) }]} />
                        {eventIndex < entry.timeline.length - 1 && <ThemeAwareView style={styles.timelineLine} />}
                      </ThemeAwareView>
                      <Text style={styles.timelineStatus}>{incidentStatusLabel(event.status)}</Text>
                      <Text style={styles.timelineTime}>{formatDateTime(event.at)}</Text>
                    </ThemeAwareView>
                  ))}
                </ThemeAwareView>

                {entry.location ? <ThemeAwareView style={styles.section}><Text style={styles.sectionTitle}>REPORTED LOCATION</Text><Text style={styles.bodyText}>{entry.location}</Text></ThemeAwareView> : null}
                {entry.description ? <ThemeAwareView style={styles.section}><Text style={styles.sectionTitle}>INCIDENT DETAILS</Text><Text style={styles.bodyText}>{entry.description}</Text></ThemeAwareView> : null}
                {entry.responseEtaMinutes != null && <Text style={styles.meta}>Response ETA: {entry.responseEtaMinutes} min</Text>}
                {entry.responseOrganizations ? <Text style={styles.meta}>Organizations: {entry.responseOrganizations}</Text> : null}
                {entry.responseNotes ? <ThemeAwareView style={styles.section}><Text style={styles.sectionTitle}>RESPONSE NOTES</Text><Text style={styles.bodyText}>{entry.responseNotes}</Text></ThemeAwareView> : null}
                {entry.photoUris.length > 0 && <ThemeAwareView style={styles.section}><Text style={styles.sectionTitle}>SCENE PHOTOS</Text><PhotoGallery uris={entry.photoUris} style={styles.photos} thumbnailStyle={styles.photo} /></ThemeAwareView>}
              </ThemeAwareView>
            </Reveal>
          ))}
        </ThemeAwareView>
      </ThemeAwareScrollView>
    </ThemeAwareSafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: 100 },
  titleBand: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headingCopy: { flex: 1 },
  eyebrow: { color: 'rgba(255,255,255,0.78)', fontFamily: kitFonts.bold, fontSize: 9, letterSpacing: 1.8 },
  title: { color: '#FFFFFF', fontFamily: kitFonts.heading, fontSize: 24, marginTop: 3 },
  subtitle: { color: 'rgba(255,255,255,0.88)', fontFamily: kitFonts.medium, fontSize: 11, marginTop: 3 },
  body: { paddingHorizontal: 14, paddingTop: 16 },
  loading: { color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 13, paddingVertical: 16 },
  emptyState: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 38, borderRadius: 22, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  emptyTitle: { color: Colors.text, fontFamily: kitFonts.heading, fontSize: 16, marginTop: 10 },
  empty: { color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5 },
  card: { backgroundColor: Colors.surface, borderRadius: 22, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: Colors.border, shadowColor: '#103A18', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 3 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  incidentIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  name: { color: Colors.text, fontFamily: kitFonts.heading, fontSize: 16 },
  meta: { color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 11, lineHeight: 16, marginTop: 4 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  status: { fontFamily: kitFonts.bold, fontSize: 9, textTransform: 'uppercase' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  metric: { width: '48%', minHeight: 72, flexGrow: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 14, backgroundColor: Colors.surfaceMuted },
  metricIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#FFF1F6' },
  metricCopy: { flex: 1, minWidth: 0 },
  metricLabel: { color: Colors.textMuted, fontFamily: kitFonts.bold, fontSize: 8, letterSpacing: 0.5 },
  metricValue: { color: Colors.text, fontFamily: kitFonts.semibold, fontSize: 11, lineHeight: 16, marginTop: 4 },
  section: { paddingTop: 14, marginTop: 13, borderTopWidth: 1, borderTopColor: Colors.border },
  sectionTitle: { color: GREEN, fontFamily: kitFonts.bold, fontSize: 9, letterSpacing: 1 },
  bodyText: { color: Colors.text, fontFamily: kitFonts.medium, fontSize: 12, lineHeight: 18, marginTop: 6 },
  timelineRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 8 },
  timelineMarker: { width: 10, height: 34, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, zIndex: 1 },
  timelineLine: { position: 'absolute', top: 21, bottom: -5, width: 1, backgroundColor: Colors.border },
  timelineStatus: { color: Colors.text, fontFamily: kitFonts.semibold, fontSize: 11, minWidth: 92 },
  timelineTime: { flex: 1, color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 10 },
  photos: { marginTop: 8 },
  photo: { width: 76, height: 76, marginRight: 8, borderRadius: 12, backgroundColor: Colors.surfaceMuted },
});
