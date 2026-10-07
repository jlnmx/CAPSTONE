import React, { useEffect, useMemo, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import { AnimatedPressable } from '@components/Buttons';
import { EvacuationStatus, getResponderData, ResponderEvacuee, updateEvacueeStatus } from '@services/responderData';
import { authenticatedFetch } from '@services/apiClient';

const GREEN = '#218B25';
const FILTERS = ['ALL', 'REGISTERED', 'CHECKED IN', 'EVACUATED', 'RELEASED'];

type CenterRegistration = {
  id: string;
  status: EvacuationStatus;
  resident_name: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  age: number;
  sex: string;
  contact_number: string;
  address: string;
  household_size: number;
  center_name: string;
  center_location: string;
  members: Array<{ id: string; name: string; relationship: string }>;
};

export default function EvacueesScreen() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [evacuees, setEvacuees] = useState<ResponderEvacuee[]>([]);
  const [registrations, setRegistrations] = useState<CenterRegistration[]>([]);
  const [registrationError, setRegistrationError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setEvacuees((await getResponderData()).evacuees);
      } catch {
        Alert.alert('Live data unavailable', 'Evacuee records could not be loaded from the server database.');
      } finally {
        setIsLoading(false);
      }
      try {
        const response = await authenticatedFetch('/api/v1/evacuation-registrations');
        if (!response.ok) throw new Error('Registration queue unavailable.');
        setRegistrations(await response.json() as CenterRegistration[]);
        setRegistrationError('');
      } catch {
        setRegistrationError('Center registrations are unavailable.');
      }
    };
    void load();
    const refresh = setInterval(() => void load(), 15000);
    return () => clearInterval(refresh);
  }, []);

  const filteredEvacuees = useMemo(() => evacuees.filter((evacuee) => {
    const name = `${evacuee.firstName} ${evacuee.middleName ?? ''} ${evacuee.lastName}`.toLowerCase();
    const matchesSearch = `${name} ${evacuee.barangay ?? ''}`.includes(search.toLowerCase());
    const matchesFilter = filter === 'ALL' || evacuee.evacuationStatus.replace('_', ' ').toUpperCase() === filter;
    return matchesSearch && matchesFilter;
  }), [evacuees, filter, search]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heading}><Text style={styles.headingText}>EVACUEES</Text></View>
        <View style={styles.registrationSection}>
          <Text style={styles.registrationHeading}>CENTER CHECK-INS</Text>
          {!!registrationError && <Text style={styles.registrationMessage}>{registrationError}</Text>}
          {registrations.map((registration) => (
            <CenterRegistrationRow
              key={registration.id}
              registration={registration}
              onStatusChange={async (nextStatus) => {
                try {
                  const response = await authenticatedFetch(`/api/v1/evacuation-registrations/${encodeURIComponent(registration.id)}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: nextStatus }),
                  });
                  if (!response.ok) {
                    const error = await response.json() as { detail?: unknown };
                    throw new Error(typeof error.detail === 'string' ? error.detail : 'Status update failed.');
                  }
                  setRegistrations((current) => current.map((item) => item.id === registration.id ? { ...item, status: nextStatus } : item));
                } catch (error) {
                  Alert.alert('Status update failed', error instanceof Error ? error.message : 'The status was not saved.');
                }
              }}
            />
          ))}
          {!registrationError && registrations.length === 0 && <Text style={styles.registrationMessage}>No household check-ins are waiting.</Text>}
        </View>
        <View style={styles.source}><MaterialCommunityIcons name="database-check-outline" size={16} color="#167A5B" /><Text style={styles.sourceText}>Live PostgreSQL records · {evacuees.length} total</Text></View>
        <View style={styles.searchBar}><MaterialCommunityIcons name="magnify" size={20} color={Colors.white} /><TextInput value={search} onChangeText={setSearch} placeholder="Search residents" placeholderTextColor="#D9F0D9" style={styles.searchInput} /></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((item) => <AnimatedPressable key={item} style={[styles.filterChip, filter === item && styles.activeFilter]} onPress={() => setFilter(item)}><Text style={[styles.filterText, filter === item && styles.activeFilterText]}>{item}</Text></AnimatedPressable>)}
        </ScrollView>
        <View style={styles.list}>
          {isLoading && <Text style={styles.emptyText}>Loading live evacuee records...</Text>}
          {filteredEvacuees.map((evacuee) => <EvacueeRow key={evacuee.id} evacuee={evacuee} onStatusChange={async (status) => { try { await updateEvacueeStatus(evacuee.id, status); setEvacuees((current) => current.map((item) => item.id === evacuee.id ? { ...item, evacuationStatus: status } : item)); } catch { Alert.alert('Update failed', 'The evacuation status was not saved.'); } }} />)}
          {!isLoading && filteredEvacuees.length === 0 && <Text style={styles.emptyText}>No evacuees found.</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CenterRegistrationRow({ registration, onStatusChange }: { registration: CenterRegistration; onStatusChange: (status: EvacuationStatus) => void }) {
  const name = [registration.first_name, registration.middle_name, registration.last_name].filter(Boolean).join(' ');
  const nextStatus: EvacuationStatus | null = registration.status === 'registered' ? 'checked_in' : registration.status === 'checked_in' ? 'evacuated' : registration.status === 'evacuated' ? 'released' : null;
  return (
    <View style={styles.registrationCard}>
      <View style={styles.registrationCardTop}>
        <View style={styles.registrationCopy}>
          <Text style={styles.registrationName}>{name || registration.resident_name}</Text>
          <Text style={styles.registrationDetail}>{registration.household_size} people · {registration.age} years · {registration.sex}</Text>
          <Text style={styles.registrationDetail}>{registration.center_name} · {registration.center_location}</Text>
          {registration.members.map((member) => <Text key={member.id} style={styles.registrationDetail}>{member.name} · {member.relationship}</Text>)}
        </View>
        <Text style={styles.registrationStatus}>{registration.status.replace('_', ' ').toUpperCase()}</Text>
      </View>
      {nextStatus && <AnimatedPressable style={styles.verifyButton} onPress={() => onStatusChange(nextStatus)}><Text style={styles.verifyText}>{registration.status === 'registered' ? 'Verify check-in' : `Mark ${nextStatus.replace('_', ' ')}`}</Text></AnimatedPressable>}
    </View>
  );
}

function EvacueeRow({ evacuee, onStatusChange }: { evacuee: ResponderEvacuee; onStatusChange: (status: EvacuationStatus) => void }) {
  const nextStatus: EvacuationStatus = evacuee.evacuationStatus === 'registered' ? 'checked_in' : evacuee.evacuationStatus === 'checked_in' ? 'evacuated' : evacuee.evacuationStatus === 'evacuated' ? 'released' : 'registered';
  return <View style={styles.row}><View style={styles.avatar}><MaterialCommunityIcons name="account" size={25} color="#6F9E72" /></View><View style={styles.rowCopy}><Text style={styles.name}>{evacuee.firstName} {evacuee.lastName}</Text><Text style={styles.details}>{evacuee.sex} · {evacuee.age} years old</Text><Text style={styles.details}>{evacuee.barangay || 'Barangay not provided'} · <Text style={styles.status}>{evacuee.evacuationStatus.replace('_', ' ')}</Text></Text><AnimatedPressable style={styles.verifyButton} onPress={() => onStatusChange(nextStatus)}><Text style={styles.verifyText}>Mark {nextStatus.replace('_', ' ')}</Text></AnimatedPressable></View><View style={[styles.statusDot, { backgroundColor: evacuee.evacuationStatus === 'released' ? '#667085' : '#218B25' }]} /></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.white },
  container: { flex: 1, backgroundColor: Colors.white },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: 18 },
  heading: { backgroundColor: GREEN, height: 86, justifyContent: 'center', paddingHorizontal: 16 },
  headingText: { color: Colors.white, fontSize: 25, fontWeight: '800' },
  registrationSection: { marginHorizontal: 16, marginTop: 13, padding: 10, borderWidth: 1, borderColor: '#78B578', borderRadius: 7, backgroundColor: Colors.white },
  registrationHeading: { color: '#17591D', fontSize: 12, fontWeight: '800' },
  registrationMessage: { paddingVertical: 10, color: Colors.textMuted, fontSize: 11 },
  registrationCard: { marginTop: 8, padding: 9, borderWidth: 1, borderColor: '#D3E3D3', borderRadius: 6, backgroundColor: '#F7FAF7' },
  registrationCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  registrationCopy: { flex: 1 },
  registrationName: { color: '#17591D', fontSize: 12, fontWeight: '800' },
  registrationDetail: { marginTop: 3, color: '#526652', fontSize: 10 },
  registrationStatus: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: '#E8F3E8', color: GREEN, fontSize: 8, fontWeight: '800' },
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
  verifyButton: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 5, backgroundColor: '#E7F0E7' },
  verifyText: { color: GREEN, fontSize: 10, fontWeight: '700' },
  emptyText: { color: Colors.textMuted, paddingVertical: 24, textAlign: 'center', fontSize: 12 },
});
