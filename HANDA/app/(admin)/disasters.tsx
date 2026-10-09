import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable as TouchableOpacity } from '@components/Buttons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, Shadows, Spacing } from '@constants/colors';
import { authenticatedFetch } from '@services/apiClient';

interface Disaster { id: string; name: string; description: string; severity: 'low' | 'medium' | 'high' | 'critical'; status: 'Upcoming' | 'Active' | 'Archived'; affected_areas: number; started_at: string | null; }
export default function AdminDisasters() {
  const [events, setEvents] = useState<Disaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Disaster['severity']>('medium');
  const [status, setStatus] = useState<Disaster['status']>('Active');
  const [affectedAreas, setAffectedAreas] = useState('0');

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

  const create = () => {
    setName('');
    setDescription('');
    setSeverity('medium');
    setStatus('Active');
    setAffectedAreas('0');
    setIsCreateOpen(true);
  };

  const submitCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Check disaster details', 'Enter a disaster name.');
      return;
    }
    setIsSaving(true);
    try {
      const response = await authenticatedFetch('/api/v1/disasters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), description: description.trim(), status, severity, affectedAreas: Number(affectedAreas) }) });
      if (!response.ok) throw new Error();
      setIsCreateOpen(false);
      await loadDisasters();
    } catch {
      Alert.alert('Unable to save', 'The disaster could not be saved to PostgreSQL.');
    } finally {
      setIsSaving(false);
    }
  };

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}><View style={styles.heading}><View><Text style={styles.eyebrow}>EVENT CONTROL</Text><Text style={styles.title}>Disaster events</Text><Text style={styles.subtitle}>Live ongoing and upcoming disaster reports from PostgreSQL.</Text></View><TouchableOpacity style={styles.primary} onPress={create}><MaterialCommunityIcons name="plus" size={18} color={Colors.white} /><Text style={styles.primaryText}>Create event</Text></TouchableOpacity></View>{error && <Text style={styles.error}>{error}</Text>}{isLoading && <Text style={styles.empty}>Loading disaster records...</Text>}{!isLoading && !error && events.length === 0 && <View style={styles.emptyState}><MaterialCommunityIcons name="weather-hurricane-outline" size={32} color={Colors.textMuted} /><Text style={styles.emptyTitle}>No disaster reports</Text><Text style={styles.empty}>Ongoing or upcoming disasters reported by users will appear here.</Text></View>}<View style={styles.list}>{events.map((event) => <View style={styles.card} key={event.id}><View style={styles.icon}><MaterialCommunityIcons name="weather-hurricane" size={24} color={event.status === 'Active' ? Colors.emergency : Colors.textMuted} /></View><View style={styles.copy}><Text style={styles.name}>{event.name}</Text><Text style={styles.detail}>{event.id} · {event.affected_areas} affected areas{event.started_at ? ` · Started ${new Date(event.started_at).toLocaleString()}` : ''}</Text></View><Text style={[styles.status, { color: event.status === 'Active' ? Colors.emergency : Colors.textMuted }]}>{event.status}</Text></View>)}</View></ScrollView><Modal visible={isCreateOpen} transparent animationType="fade" onRequestClose={() => setIsCreateOpen(false)}><Pressable style={styles.backdrop} onPress={() => setIsCreateOpen(false)}><Pressable style={styles.dialog} onPress={(event) => event.stopPropagation()}><View style={styles.dialogHeader}><View><Text style={styles.dialogTitle}>Create disaster event</Text><Text style={styles.dialogSubtitle}>This event will be visible to residents and responders.</Text></View><Pressable onPress={() => setIsCreateOpen(false)} accessibilityLabel="Close disaster form"><MaterialCommunityIcons name="close" size={22} color={Colors.textMuted} /></Pressable></View><Text style={styles.label}>Disaster name</Text><TextInput value={name} onChangeText={setName} placeholder="e.g. Flood Response" placeholderTextColor={Colors.textMuted} style={styles.input} /><Text style={styles.label}>Description</Text><TextInput value={description} onChangeText={setDescription} placeholder="What should people know?" placeholderTextColor={Colors.textMuted} style={[styles.input, styles.multiline]} multiline /><Text style={styles.label}>Severity</Text><View style={styles.options}>{(['low', 'medium', 'high', 'critical'] as const).map((option) => <Pressable key={option} onPress={() => setSeverity(option)} style={[styles.option, severity === option && styles.optionSelected]}><Text style={[styles.optionText, severity === option && styles.optionSelectedText]}>{option.toUpperCase()}</Text></Pressable>)}</View><Text style={styles.label}>Status</Text><View style={styles.options}>{(['Active', 'Upcoming', 'Archived'] as const).map((option) => <Pressable key={option} onPress={() => setStatus(option)} style={[styles.option, status === option && styles.optionSelected]}><Text style={[styles.optionText, status === option && styles.optionSelectedText]}>{option}</Text></Pressable>)}</View><Text style={styles.label}>Affected areas</Text><TextInput value={affectedAreas} onChangeText={setAffectedAreas} keyboardType="number-pad" placeholder="0" placeholderTextColor={Colors.textMuted} style={styles.input} /><View style={styles.actions}><Pressable onPress={() => setIsCreateOpen(false)} style={styles.cancelButton} disabled={isSaving}><Text style={styles.cancelText}>Cancel</Text></Pressable><TouchableOpacity onPress={() => void submitCreate()} style={styles.saveButton} disabled={isSaving}>{isSaving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveText}>Save event</Text>}</TouchableOpacity></View></Pressable></Pressable></Modal></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: Colors.surfaceMuted }, content: { padding: Spacing.xl, maxWidth: 1100, width: '100%', alignSelf: 'center' }, heading: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, marginBottom: 22 }, eyebrow: { color: Colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }, title: { color: Colors.text, fontSize: 30, fontWeight: '800', marginTop: 5 }, subtitle: { color: Colors.textMuted, fontSize: 14, marginTop: 6 }, primary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, paddingHorizontal: 15, paddingVertical: 12, borderRadius: BorderRadius.md }, primaryText: { color: Colors.white, fontSize: 12, fontWeight: '700' }, list: { gap: 12 }, card: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: Colors.surface, padding: 17, borderRadius: BorderRadius.md, ...Shadows.sm }, icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1 }, name: { color: Colors.text, fontSize: 14, fontWeight: '800' }, detail: { color: Colors.textMuted, fontSize: 11, marginTop: 5 }, status: { fontSize: 11, fontWeight: '800' }, error: { color: Colors.emergency, fontSize: 12, marginBottom: 16 }, emptyState: { alignItems: 'center', backgroundColor: Colors.surface, padding: 32, borderRadius: BorderRadius.md, ...Shadows.sm }, emptyTitle: { color: Colors.text, fontSize: 15, fontWeight: '800', marginTop: 10 }, empty: { color: Colors.textMuted, fontSize: 12, marginTop: 8, textAlign: 'center' }, backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.42)' }, dialog: { width: '100%', maxWidth: 560, maxHeight: '92%', padding: 20, borderRadius: BorderRadius.md, backgroundColor: Colors.surface }, dialogHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 8 }, dialogTitle: { color: Colors.text, fontSize: 20, fontWeight: '800' }, dialogSubtitle: { color: Colors.textMuted, fontSize: 11, marginTop: 4 }, label: { color: Colors.text, fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 6 }, input: { minHeight: 44, paddingHorizontal: 11, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm, color: Colors.text, backgroundColor: Colors.surface, fontSize: 13 }, multiline: { minHeight: 76, paddingTop: 10, textAlignVertical: 'top' }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, option: { paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm }, optionSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary }, optionText: { color: Colors.textMuted, fontSize: 10, fontWeight: '700' }, optionSelectedText: { color: Colors.white }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 18 }, cancelButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 15, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm }, cancelText: { color: Colors.text, fontSize: 12, fontWeight: '700' }, saveButton: { minWidth: 110, minHeight: 42, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 15, borderRadius: BorderRadius.sm, backgroundColor: Colors.primary }, saveText: { color: Colors.white, fontSize: 12, fontWeight: '800' } });
