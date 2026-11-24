import { ThemeAwareView, ThemeAwareScrollView } from '@components/ThemeAware';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Colors } from '@constants/colors';
import { ActivityIndicator, Animated, Easing, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { authenticatedFetch } from '@services/apiClient';
import { markActiveIncidentNotificationsRead } from '@services/incidentNotifications';
import { useIncidentFeed } from '@hooks/useRealtime';
import { KIT_GREEN as GREEN, Reveal, kitFonts } from '@components/IncidentCardKit';

type ResidentIncident = {
  id: string;
  type: string;
  location: string;
  status: string;
  isOwnReport: boolean;
  createdAt: string;
};

function normalizeIncident(record: Record<string, unknown>): ResidentIncident {
  return {
    id: String(record.id),
    type: String(record.type ?? 'Incident'),
    location: String(record.location ?? record.location_text ?? 'Location unavailable'),
    status: String(record.status ?? 'reported'),
    isOwnReport: record.is_own_report === true || record.isOwnReport === true,
    createdAt: String(record.createdAt ?? record.created_at ?? ''),
  };
}

function displayLocationLabel(location: string): string {
  const label = location.trim();
  return label && !['location not provided', 'location unavailable'].includes(label.toLowerCase())
    ? label
    : 'Location unavailable';
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
      setIncidents(records.map(normalizeIncident));
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
    void markActiveIncidentNotificationsRead().catch((error: unknown) => {
      console.warn('Active incident notifications could not be marked as read.', error);
    });
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
    <ThemeAwareScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void load(true)} tintColor={GREEN} />}>
      <Reveal index={0}>
        <ThemeAwareView style={styles.heading}>
          <ThemeAwareView style={styles.headingCopy}>
            <Text style={styles.eyebrow}>COMMUNITY WATCH</Text>
            <Text style={styles.title}>Current incidents</Text>
            <Text style={styles.subtitle}>Live reports around Biñan City, including updates to incidents you reported.</Text>
          </ThemeAwareView>
          <ThemeAwareView style={styles.radar}>
            <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}><MaterialCommunityIcons name="radar" size={30} color={GREEN} /></Animated.View>
          </ThemeAwareView>
        </ThemeAwareView>
      </Reveal>
      {isLoading && <ActivityIndicator color={GREEN} style={styles.loader} />}
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!isLoading && !error && incidents.length === 0 && <Reveal index={1}><ThemeAwareView style={styles.empty}><ThemeAwareView style={styles.emptyIcon}><MaterialCommunityIcons name="shield-check-outline" size={34} color={GREEN} /></ThemeAwareView><Text style={styles.emptyTitle}>No active incidents</Text><Text style={styles.emptyText}>New community reports will appear here as they are posted.</Text></ThemeAwareView></Reveal>}
      {incidents.map((incident, index) => {
        return <Reveal index={index + 1} key={incident.id}>
          <ThemeAwareView style={styles.card}>
            <ThemeAwareView style={[styles.accent, { backgroundColor: GREEN }]} />
            <ThemeAwareView style={styles.cardHeader}>
              <ThemeAwareView style={styles.incidentIcon}><MaterialCommunityIcons name="alert-outline" size={18} color={GREEN} /></ThemeAwareView>
              <ThemeAwareView style={styles.cardCopy}>
                <Text style={styles.cardTitle} numberOfLines={1}>{incident.type}</Text>
                <ThemeAwareView style={styles.metaRow}><MaterialCommunityIcons name="clock-outline" size={12} color={Colors.textMuted} /><Text style={styles.time}>{formatTime(incident.createdAt)}</Text></ThemeAwareView>
              </ThemeAwareView>
              {incident.isOwnReport && <ThemeAwareView style={styles.reportBadges}>
                <ThemeAwareView style={styles.ownReportBadge}><MaterialCommunityIcons name="account-check-outline" size={12} color="#A84F7D" /><Text style={styles.ownReportText}>Your report</Text></ThemeAwareView>
                <ThemeAwareView style={[styles.incidentStatusBadge, { backgroundColor: statusColors(incident.status).backgroundColor }]}><Text style={[styles.incidentStatusText, { color: statusColors(incident.status).color }]}>{formatStatus(incident.status)}</Text></ThemeAwareView>
              </ThemeAwareView>}
            </ThemeAwareView>
            <ThemeAwareView style={styles.location}>
              <ThemeAwareView style={styles.locationIcon}><MaterialCommunityIcons name="map-marker-radius-outline" size={18} color={GREEN} /></ThemeAwareView>
              <ThemeAwareView style={styles.locationCopy}>
                <Text style={styles.locationLabel}>INCIDENT LOCATION</Text>
                <Text style={styles.locationText}>{displayLocationLabel(incident.location)}</Text>
              </ThemeAwareView>
            </ThemeAwareView>
          </ThemeAwareView>
        </Reveal>;
      })}
    </ThemeAwareScrollView>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusColors(status: string) {
  switch (status.toLowerCase()) {
    case 'acknowledged': return { color: '#976600', backgroundColor: '#FFF5D9' };
    case 'in_progress': return { color: '#1768A5', backgroundColor: '#E8F4FC' };
    case 'resolved': return { color: '#287747', backgroundColor: '#EAF6EE' };
    default: return { color: '#A84F7D', backgroundColor: '#FFF1F6' };
  }
}

const styles = StyleSheet.create({
  content: { padding: 14, paddingBottom: 26, backgroundColor: Colors.background },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headingCopy: { flex: 1, paddingRight: 10 },
  eyebrow: { color: GREEN, fontFamily: kitFonts.bold, fontSize: 10, letterSpacing: 1.6 },
  title: { color: Colors.text, fontFamily: kitFonts.heading, fontSize: 23, marginTop: 3 },
  subtitle: { maxWidth: 300, color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 12, lineHeight: 17, marginTop: 4 },
  radar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1F6', borderWidth: 1, borderColor: '#F1C7D9' },
  loader: { marginVertical: 24 },
  error: { color: '#B42318', fontFamily: kitFonts.medium, fontSize: 12, lineHeight: 17, paddingVertical: 12 },
  empty: { alignItems: 'center', paddingVertical: 45, paddingHorizontal: 30, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, backgroundColor: Colors.surface },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1F6' },
  emptyTitle: { color: Colors.text, fontFamily: kitFonts.heading, fontSize: 16, marginTop: 12 },
  emptyText: { color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 5 },
  card: { padding: 14, paddingLeft: 18, marginBottom: 14, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, overflow: 'hidden', backgroundColor: Colors.surface, shadowColor: '#103A18', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.09, shadowRadius: 14, elevation: 3 },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  incidentIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#FFF1F6' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardCopy: { flex: 1, minWidth: 0 },
  reportBadges: { alignItems: 'flex-end', gap: 5, marginLeft: 4 },
  ownReportBadge: { minHeight: 22, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, borderRadius: 11, backgroundColor: '#FFF1F6' },
  ownReportText: { color: '#A84F7D', fontFamily: kitFonts.bold, fontSize: 9 },
  incidentStatusBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 9 },
  incidentStatusText: { fontFamily: kitFonts.bold, fontSize: 9 },
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
