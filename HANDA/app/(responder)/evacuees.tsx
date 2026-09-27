import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import { AnimatedPressable } from '@components/Buttons';
import { AdminDataSnapshot, getAdminData } from '@services/adminData';

const GREEN = '#218B25';
const FILTERS = ['ALL', 'PENDING SYNC', 'SYNCED'];

export default function EvacueesScreen() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [data, setData] = useState<AdminDataSnapshot>({ incidents: [], evacuees: [], source: 'unavailable' });

  useEffect(() => {
    void getAdminData().then(setData);
  }, []);

  const evacuees = useMemo(() => data.evacuees.filter((evacuee) => {
    const name = `${evacuee.firstName} ${evacuee.middleName ?? ''} ${evacuee.lastName}`.toLowerCase();
    const matchesSearch = `${name} ${evacuee.barangay ?? ''}`.includes(search.toLowerCase());
    const matchesFilter = filter === 'ALL' || evacuee.syncStatus.toUpperCase() === filter;
    return matchesSearch && matchesFilter;
  }), [data.evacuees, filter, search]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heading}><Text style={styles.headingText}>EVACUEES</Text></View>
        <View style={styles.source}><MaterialCommunityIcons name="database-check-outline" size={16} color={data.source === 'remote' ? '#167A5B' : '#8B5E00'} /><Text style={styles.sourceText}>{data.source === 'remote' ? 'PostgreSQL records' : 'PostgreSQL unavailable'} · {data.evacuees.length} total</Text></View>
        <View style={styles.searchBar}><MaterialCommunityIcons name="magnify" size={20} color={Colors.white} /><TextInput value={search} onChangeText={setSearch} placeholder="Search residents" placeholderTextColor="#D9F0D9" style={styles.searchInput} /></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((item) => <AnimatedPressable key={item} style={[styles.filterChip, filter === item && styles.activeFilter]} onPress={() => setFilter(item)}><Text style={[styles.filterText, filter === item && styles.activeFilterText]}>{item}</Text></AnimatedPressable>)}
        </ScrollView>
        <View style={styles.list}>
          {evacuees.map((evacuee) => <EvacueeRow key={evacuee.id} evacuee={evacuee} />)}
          {evacuees.length === 0 && <Text style={styles.emptyText}>No evacuees found.</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function EvacueeRow({ evacuee }: { evacuee: AdminDataSnapshot['evacuees'][number] }) {
  return <View style={styles.row}><View style={styles.avatar}><MaterialCommunityIcons name="account" size={25} color="#6F9E72" /></View><View style={styles.rowCopy}><Text style={styles.name}>{evacuee.firstName} {evacuee.lastName}</Text><Text style={styles.details}>{evacuee.sex} · {evacuee.age} years old</Text><Text style={styles.details}>{evacuee.barangay || 'Barangay not provided'} · <Text style={styles.status}>{evacuee.syncStatus}</Text></Text></View><View style={[styles.statusDot, { backgroundColor: evacuee.syncStatus === 'pending' ? '#D6A91D' : '#218B25' }]} /></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.white },
  container: { flex: 1, backgroundColor: Colors.white },
  content: { paddingBottom: 12 },
  heading: { backgroundColor: GREEN, height: 86, justifyContent: 'center', paddingHorizontal: 16 },
  headingText: { color: Colors.white, fontSize: 25, fontWeight: '800' },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 12 },
  sourceText: { color: Colors.textMuted, fontSize: 11 },
  searchBar: { margin: 16, height: 40, borderRadius: 7, backgroundColor: GREEN, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  searchInput: { flex: 1, color: Colors.white, fontSize: 12, paddingHorizontal: 9 },
  filters: { gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  filterChip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 14, backgroundColor: '#E7F0E7' },
  activeFilter: { backgroundColor: GREEN },
  filterText: { color: '#548B56', fontSize: 10, fontWeight: '700' },
  activeFilterText: { color: Colors.white },
  list: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderTopWidth: 1, borderTopColor: '#E8EFE8' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EAF3EA', alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, marginLeft: 12 },
  name: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  details: { color: Colors.textMuted, fontSize: 11, marginTop: 3 },
  status: { color: GREEN, fontWeight: '700' },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  emptyText: { color: Colors.textMuted, paddingVertical: 24, textAlign: 'center', fontSize: 12 },
});
