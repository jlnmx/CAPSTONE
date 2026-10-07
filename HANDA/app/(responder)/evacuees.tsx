import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import { AnimatedPressable } from '@components/Buttons';
import { EvacuationStatus } from '@services/responderData';
import { authenticatedFetch } from '@services/apiClient';

const GREEN = '#218B25';
const FILTERS: Array<'ALL' | EvacuationStatus> = ['ALL', 'registered', 'checked_in', 'evacuated', 'released'];
type SortMode = 'recent' | 'name';

type CenterRegistration = {
  id: string;
  status: EvacuationStatus;
  registered_at: string;
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
  const [filter, setFilter] = useState<typeof FILTERS[number]>('ALL');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [registrations, setRegistrations] = useState<CenterRegistration[]>([]);
  const [registrationError, setRegistrationError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    try {
      const response = await authenticatedFetch('/api/v1/evacuation-registrations?include_released=true');
      if (!response.ok) throw new Error('Registration list unavailable.');
      setRegistrations(await response.json() as CenterRegistration[]);
      setRegistrationError('');
    } catch {
      setRegistrationError('Registered evacuees are unavailable.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const refresh = setInterval(() => void load(), 15000);
    return () => clearInterval(refresh);
  }, []);

  const visibleRegistrations = useMemo(() => registrations
    .filter((registration) => filter === 'ALL' || registration.status === filter)
    .filter((registration) => {
      const name = [registration.first_name, registration.middle_name, registration.last_name, registration.resident_name].filter(Boolean).join(' ').toLowerCase();
      const household = registration.members.map((member) => `${member.name} ${member.relationship}`).join(' ').toLowerCase();
      const location = `${registration.center_name} ${registration.center_location}`.toLowerCase();
      return `${name} ${household} ${location}`.includes(search.trim().toLowerCase());
    })
    .sort((left, right) => sortMode === 'name'
      ? getRegistrationName(left).localeCompare(getRegistrationName(right))
      : String(right.registered_at).localeCompare(String(left.registered_at))), [registrations, filter, search, sortMode]);

  const updateStatus = async (registration: CenterRegistration, nextStatus: EvacuationStatus) => {
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
  };

  return <SafeAreaView style={styles.safeArea}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.heading}><Text style={styles.headingText}>EVACUEES</Text></View>
      <View style={styles.source}><MaterialCommunityIcons name="database-check-outline" size={16} color="#167A5B" /><Text style={styles.sourceText}>Live PostgreSQL registrations · {registrations.length} households</Text></View>
      <View style={styles.searchBar}><MaterialCommunityIcons name="magnify" size={20} color={Colors.white} /><TextInput value={search} onChangeText={setSearch} placeholder="Search registrants, household members, or centers" placeholderTextColor="#D9F0D9" style={styles.searchInput} /></View>
      <View style={styles.toolbar}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{FILTERS.map((item) => <AnimatedPressable key={item} style={[styles.filterChip, filter === item && styles.activeFilter]} onPress={() => setFilter(item)}><Text style={[styles.filterText, filter === item && styles.activeFilterText]}>{item === 'ALL' ? 'ALL' : item.replace('_', ' ').toUpperCase()}</Text></AnimatedPressable>)}</ScrollView><Pressable style={styles.sortButton} onPress={() => setSortMode(sortMode === 'recent' ? 'name' : 'recent')}><MaterialCommunityIcons name="sort" size={16} color={GREEN} /><Text style={styles.sortText}>{sortMode === 'recent' ? 'Recent' : 'Name'}</Text></Pressable></View>
      <View style={styles.list}>
        {isLoading && <Text style={styles.emptyText}>Loading registered evacuees...</Text>}
        {!!registrationError && <Text style={styles.emptyText}>{registrationError}</Text>}
        {visibleRegistrations.map((registration) => <RegistrationRow key={registration.id} registration={registration} expanded={expandedId === registration.id} onPress={() => setExpandedId(expandedId === registration.id ? null : registration.id)} onStatusChange={(status) => void updateStatus(registration, status)} />)}
        {!isLoading && !registrationError && visibleRegistrations.length === 0 && <Text style={styles.emptyText}>No registered evacuees found.</Text>}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function getRegistrationName(registration: CenterRegistration): string {
  return [registration.first_name, registration.middle_name, registration.last_name].filter(Boolean).join(' ') || registration.resident_name;
}

function nextStatusFor(status: EvacuationStatus): EvacuationStatus | null {
  return status === 'registered' ? 'checked_in' : status === 'checked_in' ? 'evacuated' : status === 'evacuated' ? 'released' : null;
}

function RegistrationRow({ registration, expanded, onPress, onStatusChange }: { registration: CenterRegistration; expanded: boolean; onPress: () => void; onStatusChange: (status: EvacuationStatus) => void }) {
  const name = getRegistrationName(registration);
  const nextStatus = nextStatusFor(registration.status);
  const initials = name.split(/\s+/).map((part) => part[0] ?? '').join('').slice(0, 2).toUpperCase();
  return <View style={styles.registrationCard}>
    <Pressable onPress={onPress} style={styles.registrationRow} accessibilityRole="button" accessibilityLabel={`View ${name}`}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
      <View style={styles.rowCopy}><Text style={styles.name}>{name}</Text><Text style={styles.details}>{registration.household_size} people · {registration.center_name}</Text><Text style={styles.details}>{registration.status.replace('_', ' ').toUpperCase()}</Text></View>
      {nextStatus && <AnimatedPressable style={styles.verifyButton} onPress={() => onStatusChange(nextStatus)}><Text style={styles.verifyText}>{registration.status === 'registered' ? 'Verify check-in' : `Mark ${nextStatus.replace('_', ' ')}`}</Text></AnimatedPressable>}
      <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textMuted} />
    </Pressable>
    {expanded && <View style={styles.detailsPanel}><Text style={styles.panelTitle}>Registrant information</Text><Detail label="Age" value={`${registration.age}`} /><Detail label="Sex" value={registration.sex} /><Detail label="Contact" value={registration.contact_number} /><Detail label="Address" value={registration.address} /><Text style={styles.panelTitle}>Household members</Text>{registration.members.length === 0 ? <Text style={styles.memberRelation}>No additional household members.</Text> : registration.members.map((member) => <View style={styles.member} key={member.id}><MaterialCommunityIcons name="account-outline" size={18} color={GREEN} /><View><Text style={styles.memberName}>{member.name}</Text><Text style={styles.memberRelation}>{member.relationship}</Text></View></View>)}</View>}
  </View>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value || 'Not provided'}</Text></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.white }, container: { flex: 1, backgroundColor: Colors.white }, content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: 18 }, heading: { backgroundColor: GREEN, height: 86, justifyContent: 'center', paddingHorizontal: 16 }, headingText: { color: Colors.white, fontSize: 25, fontWeight: '800' }, source: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 12 }, sourceText: { color: Colors.textMuted, fontSize: 11 }, searchBar: { margin: 16, height: 40, borderRadius: 7, backgroundColor: GREEN, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }, searchInput: { flex: 1, color: Colors.white, fontSize: 12, paddingHorizontal: 9 }, toolbar: { flexDirection: 'row', alignItems: 'center', paddingBottom: 12 }, filters: { flexGrow: 1, gap: 8, paddingHorizontal: 16 }, filterChip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 14, backgroundColor: '#E7F0E7' }, activeFilter: { backgroundColor: GREEN }, filterText: { color: '#548B56', fontSize: 10, fontWeight: '700' }, activeFilterText: { color: Colors.white }, sortButton: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 16, padding: 7 }, sortText: { color: GREEN, fontSize: 11, fontWeight: '700' }, list: { paddingHorizontal: 16 }, registrationCard: { borderTopWidth: 1, borderTopColor: '#E8EFE8' }, registrationRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13 }, avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EAF3EA', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: GREEN, fontSize: 12, fontWeight: '800' }, rowCopy: { flex: 1 }, name: { color: Colors.text, fontSize: 13, fontWeight: '700' }, details: { color: Colors.textMuted, fontSize: 11, marginTop: 3 }, verifyButton: { alignSelf: 'center', paddingHorizontal: 9, paddingVertical: 7, borderRadius: 5, backgroundColor: '#E7F0E7' }, verifyText: { color: GREEN, fontSize: 10, fontWeight: '700' }, detailsPanel: { marginBottom: 12, marginLeft: 54, padding: 12, borderRadius: 6, backgroundColor: '#F7FAF7' }, panelTitle: { color: '#17591D', fontSize: 11, fontWeight: '800', marginBottom: 7, marginTop: 3 }, detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 3 }, detailLabel: { color: Colors.textMuted, fontSize: 10 }, detailValue: { flex: 1, color: Colors.text, fontSize: 10, textAlign: 'right' }, member: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8, marginTop: 5, borderTopWidth: 1, borderTopColor: '#D3E3D3' }, memberName: { color: Colors.text, fontSize: 11, fontWeight: '700' }, memberRelation: { color: Colors.textMuted, fontSize: 10, marginTop: 2 }, emptyText: { color: Colors.textMuted, paddingVertical: 24, textAlign: 'center', fontSize: 12 },
});
