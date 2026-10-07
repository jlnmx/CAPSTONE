import React, { useEffect, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable as TouchableOpacity } from '@components/Buttons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, Shadows, Spacing } from '@constants/colors';
import { authenticatedFetch } from '@services/apiClient';

interface Disaster { id: string; name: string; description: string; severity: 'low' | 'medium' | 'high' | 'critical'; status: 'Upcoming' | 'Active' | 'Archived'; affected_areas: number; started_at: string | null; }
export default function AdminDisasters() {
  const [events, setEvents] = useState<Disaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDisasters = async () => {
    try {
      setError('');
      const response = await authenticatedFetch('/api/v1/disasters');
      if (!response.ok) throw new Error();
      setEvents(await response.json() as Disaster[]);
    } catch {
      setError('Unable to load disaster records from PostgreSQL.');
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadDisasters(); }, []);

  const create = () => Alert.prompt('Create disaster event', 'Enter the ongoing or upcoming disaster name', async (name) => {
    if (!name?.trim()) return;
    try {
      const response = await authenticatedFetch('/api/v1/disasters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), status: 'Active', severity: 'medium', affectedAreas: 0 }) });
      if (!response.ok) throw new Error();
      await loadDisasters();
    } catch {
      Alert.alert('Unable to save', 'The disaster could not be saved to PostgreSQL.');
    }
  });

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}><View style={styles.heading}><View><Text style={styles.eyebrow}>EVENT CONTROL</Text><Text style={styles.title}>Disaster events</Text><Text style={styles.subtitle}>Live ongoing and upcoming disaster reports from PostgreSQL.</Text></View><TouchableOpacity style={styles.primary} onPress={create}><MaterialCommunityIcons name="plus" size={18} color={Colors.white} /><Text style={styles.primaryText}>Create event</Text></TouchableOpacity></View>{error && <Text style={styles.error}>{error}</Text>}{isLoading && <Text style={styles.empty}>Loading disaster records...</Text>}{!isLoading && !error && events.length === 0 && <View style={styles.emptyState}><MaterialCommunityIcons name="weather-hurricane-outline" size={32} color={Colors.textMuted} /><Text style={styles.emptyTitle}>No disaster reports</Text><Text style={styles.empty}>Ongoing or upcoming disasters reported by users will appear here.</Text></View>}<View style={styles.list}>{events.map((event) => <View style={styles.card} key={event.id}><View style={styles.icon}><MaterialCommunityIcons name="weather-hurricane" size={24} color={event.status === 'Active' ? Colors.emergency : Colors.textMuted} /></View><View style={styles.copy}><Text style={styles.name}>{event.name}</Text><Text style={styles.detail}>{event.id} · {event.affected_areas} affected areas{event.started_at ? ` · Started ${new Date(event.started_at).toLocaleString()}` : ''}</Text></View><Text style={[styles.status, { color: event.status === 'Active' ? Colors.emergency : Colors.textMuted }]}>{event.status}</Text></View>)}</View></ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: Colors.surfaceMuted }, content: { padding: Spacing.xl, maxWidth: 1100, width: '100%', alignSelf: 'center' }, heading: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, marginBottom: 22 }, eyebrow: { color: Colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }, title: { color: Colors.text, fontSize: 30, fontWeight: '800', marginTop: 5 }, subtitle: { color: Colors.textMuted, fontSize: 14, marginTop: 6 }, primary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, paddingHorizontal: 15, paddingVertical: 12, borderRadius: BorderRadius.md }, primaryText: { color: Colors.white, fontSize: 12, fontWeight: '700' }, list: { gap: 12 }, card: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: Colors.surface, padding: 17, borderRadius: BorderRadius.md, ...Shadows.sm }, icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FCE8E8', alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1 }, name: { color: Colors.text, fontSize: 14, fontWeight: '800' }, detail: { color: Colors.textMuted, fontSize: 11, marginTop: 5 }, status: { fontSize: 11, fontWeight: '800' }, error: { color: Colors.emergency, fontSize: 12, marginBottom: 16 }, emptyState: { alignItems: 'center', backgroundColor: Colors.surface, padding: 32, borderRadius: BorderRadius.md, ...Shadows.sm }, emptyTitle: { color: Colors.text, fontSize: 15, fontWeight: '800', marginTop: 10 }, empty: { color: Colors.textMuted, fontSize: 12, marginTop: 8, textAlign: 'center' } });
