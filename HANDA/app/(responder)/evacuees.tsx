import React, { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';

const GREEN = '#218B25';

type EvacueeStatus = 'Synced' | 'Pending Sync' | 'Checked In';

interface PlaceholderEvacuee {
  name: string;
  details: string;
  barangay: string;
  status: EvacueeStatus;
  color: string;
}

const PLACEHOLDER_EVACUEES: PlaceholderEvacuee[] = [
  { name: 'Juan Dela Cruz', details: 'Male · 27 years old', barangay: 'Brgy. Zapote', status: 'Synced', color: '#218B25' },
  { name: 'Maria Santos', details: 'Female · 27 years old', barangay: 'Brgy. San Antonio', status: 'Pending Sync', color: '#D6A91D' },
  { name: 'Pedro Reyes', details: 'Male · 5 years old', barangay: 'Brgy. Poblacion', status: 'Synced', color: '#218B25' },
  { name: 'Ana Garcia', details: 'Female · 32 years old', barangay: 'Brgy. San Pedro', status: 'Checked In', color: '#1E5987' },
  { name: 'Jose Cruz', details: 'Male · 19 years old', barangay: 'Brgy. Timbao', status: 'Synced', color: '#218B25' },
];

export default function EvacueesScreen() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');

  const evacuees = useMemo(() => PLACEHOLDER_EVACUEES.filter((evacuee) => {
    const matchesSearch = evacuee.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'ALL' || evacuee.status.toUpperCase() === filter;
    return matchesSearch && matchesFilter;
  }), [filter, search]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heading}><Text style={styles.headingText}>EVACUEES</Text></View>

        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="menu" size={19} color={Colors.white} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search residents"
            placeholderTextColor="#D9F0D9"
            style={styles.searchInput}
          />
          <MaterialCommunityIcons name="magnify" size={20} color={Colors.white} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {['ALL', 'CHECKED IN', 'PENDING SYNC', 'SYNCED'].map((item) => (
            <TouchableOpacity key={item} style={[styles.filterChip, filter === item && styles.activeFilter]} onPress={() => setFilter(item)}>
              <Text style={[styles.filterText, filter === item && styles.activeFilterText]}>{item === 'ALL' ? '✧  ALL' : item}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.list}>
          {evacuees.map((evacuee) => <EvacueeRow key={evacuee.name} evacuee={evacuee} />)}
          {evacuees.length === 0 && <Text style={styles.emptyText}>No evacuees found.</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function EvacueeRow({ evacuee }: { evacuee: PlaceholderEvacuee }) {
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.75}>
      <View style={styles.avatar}><MaterialCommunityIcons name="account" size={25} color="#6F9E72" /></View>
      <View style={styles.rowCopy}>
        <Text style={styles.name}>{evacuee.name}</Text>
        <Text style={styles.details}>{evacuee.details}</Text>
        <Text style={styles.details}>{evacuee.barangay} · <Text style={styles.status}>{evacuee.status}</Text></Text>
      </View>
      <View style={[styles.statusDot, { backgroundColor: evacuee.color }]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.white },
  container: { flex: 1, backgroundColor: Colors.white },
  content: { paddingBottom: 12 },
  heading: { backgroundColor: GREEN, height: 86, justifyContent: 'center', paddingHorizontal: 16 },
  headingText: { color: Colors.white, fontSize: 25, fontWeight: '800' },
  searchBar: { height: 32, marginHorizontal: 14, marginTop: 9, borderRadius: 16, backgroundColor: '#6AA86B', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  searchInput: { flex: 1, color: Colors.white, fontSize: 10, paddingVertical: 0, paddingHorizontal: 8 },
  filters: { paddingHorizontal: 14, gap: 5, paddingVertical: 7 },
  filterChip: { borderWidth: 1, borderColor: '#6AA86B', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: Colors.white },
  activeFilter: { backgroundColor: '#E8F4E8' },
  filterText: { color: '#4B854D', fontSize: 7 },
  activeFilterText: { fontWeight: '700' },
  list: { marginHorizontal: 14, gap: 6 },
  row: { minHeight: 48, borderWidth: 1, borderColor: '#6AA86B', borderRadius: 4, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 5 },
  avatar: { width: 31, height: 31, borderRadius: 16, backgroundColor: '#DDEBDD', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  rowCopy: { flex: 1 },
  name: { color: '#246727', fontSize: 9, fontWeight: '700' },
  details: { color: '#548B56', fontSize: 7, lineHeight: 10 },
  status: { color: '#D6A91D' },
  statusDot: { width: 12, height: 12, borderRadius: 6, marginRight: 5 },
  emptyText: { color: '#548B56', textAlign: 'center', padding: 24, fontSize: 11 },
});
