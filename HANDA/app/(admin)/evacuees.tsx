import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, Shadows, Spacing } from '@constants/colors';
import { AdminDataSnapshot, getAdminData } from '@services/adminData';

export default function AdminEvacuees() {
  const [data, setData] = useState<AdminDataSnapshot>({ incidents: [], evacuees: [], source: 'unavailable' });
  const [query, setQuery] = useState('');

  useEffect(() => {
    void getAdminData().then(setData);
  }, []);

  const visible = useMemo(() => data.evacuees.filter((record) => {
    const searchable = `${record.firstName} ${record.middleName ?? ''} ${record.lastName} ${record.barangay ?? ''}`.toLowerCase();
    return searchable.includes(query.toLowerCase());
  }), [data.evacuees, query]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}><View><Text style={styles.eyebrow}>EVACUEE MANAGEMENT</Text><Text style={styles.title}>Evacuee directory</Text><Text style={styles.subtitle}>Records fetched from the PostgreSQL evacuees table.</Text></View></View>
        <View style={styles.source}><MaterialCommunityIcons name="database-check-outline" size={17} color={data.source === 'remote' ? '#167A5B' : '#8B5E00'} /><Text style={styles.sourceText}>{data.source === 'remote' ? 'PostgreSQL connected' : 'PostgreSQL unavailable'}</Text></View>
        <View style={styles.summary}><Text style={styles.total}>{data.evacuees.length}</Text><Text style={styles.summaryLabel}>records in PostgreSQL</Text></View>
        <View style={styles.panel}>
          <View style={styles.search}><MaterialCommunityIcons name="magnify" size={19} color={Colors.textMuted} /><TextInput value={query} onChangeText={setQuery} placeholder="Search evacuees or barangay" placeholderTextColor={Colors.textMuted} style={styles.input} /></View>
          {visible.map((record) => <View style={styles.row} key={record.id}><View style={styles.avatar}><Text style={styles.avatarText}>{`${record.firstName[0] ?? ''}${record.lastName[0] ?? ''}`}</Text></View><View style={styles.copy}><Text style={styles.name}>{record.firstName} {record.middleName ? `${record.middleName} ` : ''}{record.lastName}</Text><Text style={styles.detail}>{record.id} · Age {record.age} · {record.barangay || 'Barangay not provided'}</Text></View><Text style={styles.status}>{record.syncStatus}</Text></View>)}
          {visible.length === 0 && <View style={styles.empty}><MaterialCommunityIcons name="account-off-outline" size={30} color={Colors.textMuted} /><Text style={styles.emptyTitle}>No evacuees registered</Text><Text style={styles.emptyDetail}>{data.source === 'remote' ? 'The PostgreSQL evacuees table currently has no records.' : 'Connect the FastAPI service to PostgreSQL to load records.'}</Text></View>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F7F9' },
  content: { padding: Spacing.xl, paddingBottom: 48, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  heading: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, marginBottom: 8 },
  eyebrow: { color: Colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: Colors.text, fontSize: 30, fontWeight: '800', marginTop: 5 },
  subtitle: { color: Colors.textMuted, fontSize: 14, marginTop: 6 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  sourceText: { color: Colors.textMuted, fontSize: 11 },
  summary: { backgroundColor: Colors.white, padding: 16, borderRadius: BorderRadius.md, marginBottom: 16, ...Shadows.sm },
  total: { color: Colors.text, fontSize: 26, fontWeight: '800' },
  summaryLabel: { color: Colors.textMuted, fontSize: 12 },
  panel: { backgroundColor: Colors.white, padding: 18, borderRadius: BorderRadius.md, ...Shadows.sm },
  search: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D7E2EA', borderRadius: BorderRadius.sm, paddingHorizontal: 10, marginBottom: 8 },
  input: { flex: 1, padding: 10, color: Colors.text, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: '#EDF1F4', paddingVertical: 14 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E4EEF4', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.primary, fontSize: 12, fontWeight: '800' },
  copy: { flex: 1 },
  name: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  detail: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
  status: { color: '#167A5B', fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 38 },
  emptyTitle: { color: Colors.text, fontSize: 14, fontWeight: '800', marginTop: 10 },
  emptyDetail: { color: Colors.textMuted, fontSize: 12, marginTop: 5, textAlign: 'center' },
});
