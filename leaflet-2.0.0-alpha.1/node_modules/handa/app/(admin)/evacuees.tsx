import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, Shadows, Spacing } from '@constants/colors';
import { AdminDataSnapshot, AdminEvacueeRecord, getAdminData } from '@services/adminData';

type ListFilter = 'all' | 'households' | 'individuals';
type SortMode = 'recent' | 'name';

type EvacueeGroup = {
  id: string;
  registrant: AdminEvacueeRecord;
  members: AdminEvacueeRecord[];
  isHousehold: boolean;
};

export default function AdminEvacuees() {
  const [data, setData] = useState<AdminDataSnapshot>({ incidents: [], evacuees: [], centers: [], activePersonnel: 0, source: 'unavailable' });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ListFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    void getAdminData().then(setData);
  }, []);

  const groups = useMemo(() => {
    const grouped = new Map<string, EvacueeGroup>();
    data.evacuees.forEach((record) => {
      const groupId = record.registrationId ?? record.id;
      const existing = grouped.get(groupId);
      if (!existing) grouped.set(groupId, { id: groupId, registrant: record, members: [], isHousehold: Boolean(record.registrationId) });
      else if (record.householdRole === 'Registrant') existing.registrant = record;
      else existing.members.push(record);
    });
    return Array.from(grouped.values());
  }, [data.evacuees]);

  const visibleGroups = useMemo(() => groups
    .filter((group) => filter === 'all' || (filter === 'households' ? group.isHousehold : !group.isHousehold))
    .filter((group) => {
      const record = group.registrant;
      const searchable = `${getDisplayName(record)} ${record.householdRole ?? ''} ${record.centerName ?? ''} ${group.members.map((member) => member.displayName).join(' ')}`.toLowerCase();
      return searchable.includes(query.trim().toLowerCase());
    })
    .sort((left, right) => sortMode === 'name'
      ? getDisplayName(left.registrant).localeCompare(getDisplayName(right.registrant))
      : String(right.registrant.createdAt ?? '').localeCompare(String(left.registrant.createdAt ?? ''))), [groups, filter, query, sortMode]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}><View><Text style={styles.eyebrow}>EVACUEE MANAGEMENT</Text><Text style={styles.title}>Evacuee directory</Text><Text style={styles.subtitle}>Records fetched from the PostgreSQL evacuees table.</Text></View></View>
        <View style={styles.source}><MaterialCommunityIcons name="database-check-outline" size={17} color={data.source === 'remote' ? '#167A5B' : '#8B5E00'} /><Text style={styles.sourceText}>{data.source === 'remote' ? 'PostgreSQL connected' : 'PostgreSQL unavailable'}</Text></View>
        <View style={styles.summary}><View><Text style={styles.total}>{data.evacuees.length}</Text><Text style={styles.summaryLabel}>people in PostgreSQL</Text></View><View><Text style={styles.total}>{groups.filter((group) => group.isHousehold).length}</Text><Text style={styles.summaryLabel}>active households</Text></View></View>
        <View style={styles.panel}>
          <View style={styles.search}><MaterialCommunityIcons name="magnify" size={19} color={Colors.textMuted} /><TextInput value={query} onChangeText={setQuery} placeholder="Search evacuees or barangay" placeholderTextColor={Colors.textMuted} style={styles.input} /></View>
          <View style={styles.toolbar}><View style={styles.filterRow}>{(['all', 'households', 'individuals'] as ListFilter[]).map((option) => <Pressable key={option} onPress={() => setFilter(option)} style={[styles.filterButton, filter === option && styles.filterButtonActive]}><Text style={[styles.filterText, filter === option && styles.filterTextActive]}>{option === 'all' ? 'All' : option === 'households' ? 'Households' : 'Individuals'}</Text></Pressable>)}</View><Pressable onPress={() => setSortMode(sortMode === 'recent' ? 'name' : 'recent')} style={styles.sortButton}><MaterialCommunityIcons name="sort" size={16} color={Colors.secondary} /><Text style={styles.sortText}>{sortMode === 'recent' ? 'Recent' : 'Name'}</Text></Pressable></View>
          {visibleGroups.map((group) => <EvacueeGroupRow key={group.id} group={group} expanded={expandedId === group.id} onPress={() => setExpandedId(expandedId === group.id ? null : group.id)} />)}
          {visibleGroups.length === 0 && <View style={styles.empty}><MaterialCommunityIcons name="account-off-outline" size={30} color={Colors.textMuted} /><Text style={styles.emptyTitle}>No evacuees found</Text><Text style={styles.emptyDetail}>{data.source === 'remote' ? 'Try another search or filter.' : 'Connect the FastAPI service to PostgreSQL to load records.'}</Text></View>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getDisplayName(record: AdminEvacueeRecord): string {
  return record.displayName ?? `${record.firstName} ${record.middleName ? `${record.middleName} ` : ''}${record.lastName}`.trim();
}

function EvacueeGroupRow({ group, expanded, onPress }: { group: EvacueeGroup; expanded: boolean; onPress: () => void }) {
  const displayName = getDisplayName(group.registrant);
  const initials = displayName.split(/\s+/).map((part) => part[0] ?? '').join('').slice(0, 2).toUpperCase();
  return <View style={styles.group}><Pressable onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={`View ${displayName}`}><View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View><View style={styles.copy}><Text style={styles.name}>{displayName}</Text><Text style={styles.detail}>{group.isHousehold ? `${group.members.length + 1} people · ${group.registrant.centerName || 'Registered household'}` : `${group.registrant.age ? `Age ${group.registrant.age}` : 'Age not provided'} · Individual record`}</Text></View><Text style={styles.status}>{group.registrant.syncStatus}</Text><MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textMuted} /></Pressable>{expanded && <View style={styles.household}><Text style={styles.householdTitle}>{group.isHousehold ? 'Household members' : 'Registrant information'}</Text><PersonDetail label="Name" value={displayName} /><PersonDetail label="Age" value={group.registrant.age ? String(group.registrant.age) : 'Not provided'} />{group.registrant.contactNumber && <PersonDetail label="Contact" value={group.registrant.contactNumber} />}{group.registrant.address && <PersonDetail label="Address" value={group.registrant.address} />}{group.members.map((member) => <View style={styles.member} key={member.id}><MaterialCommunityIcons name="account-outline" size={17} color={Colors.secondary} /><View><Text style={styles.memberName}>{member.displayName}</Text><Text style={styles.memberRelation}>{member.householdRole || 'Household member'}</Text></View></View>)}</View>}</View>;
}

function PersonDetail({ label, value }: { label: string; value: string }) {
  return <View style={styles.personDetail}><Text style={styles.personLabel}>{label}</Text><Text style={styles.personValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surfaceMuted },
  content: { padding: Spacing.xl, paddingBottom: 48, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  heading: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, marginBottom: 8 },
  eyebrow: { color: Colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: Colors.text, fontSize: 30, fontWeight: '800', marginTop: 5 },
  subtitle: { color: Colors.textMuted, fontSize: 14, marginTop: 6 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  sourceText: { color: Colors.textMuted, fontSize: 11 },
  summary: { backgroundColor: Colors.surface, padding: 16, borderRadius: BorderRadius.md, marginBottom: 16, ...Shadows.sm },
  total: { color: Colors.text, fontSize: 26, fontWeight: '800' },
  summaryLabel: { color: Colors.textMuted, fontSize: 12 },
  panel: { backgroundColor: Colors.surface, padding: 18, borderRadius: BorderRadius.md, ...Shadows.sm },
  search: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D7E2EA', borderRadius: BorderRadius.sm, paddingHorizontal: 10, marginBottom: 8 },
  input: { flex: 1, padding: 10, color: Colors.text, fontSize: 13 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterButton: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: BorderRadius.sm, backgroundColor: Colors.surfaceMuted },
  filterButtonActive: { backgroundColor: Colors.primary },
  filterText: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },
  filterTextActive: { color: Colors.white },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 7 },
  sortText: { color: Colors.secondary, fontSize: 11, fontWeight: '700' },
  group: { borderTopWidth: 1, borderTopColor: '#EDF1F4' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: '#EDF1F4', paddingVertical: 14 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E4EEF4', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.primary, fontSize: 12, fontWeight: '800' },
  copy: { flex: 1 },
  name: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  detail: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
  status: { color: '#167A5B', fontSize: 11, fontWeight: '700' },
  household: { marginBottom: 12, marginLeft: 50, padding: 12, borderRadius: BorderRadius.sm, backgroundColor: Colors.surfaceMuted },
  householdTitle: { color: Colors.text, fontSize: 12, fontWeight: '800', marginBottom: 8 },
  personDetail: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 3 },
  personLabel: { color: Colors.textMuted, fontSize: 11 },
  personValue: { flex: 1, color: Colors.text, fontSize: 11, textAlign: 'right' },
  member: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#D7E2EA' },
  memberName: { color: Colors.text, fontSize: 11, fontWeight: '700' },
  memberRelation: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 38 },
  emptyTitle: { color: Colors.text, fontSize: 14, fontWeight: '800', marginTop: 10 },
  emptyDetail: { color: Colors.textMuted, fontSize: 12, marginTop: 5, textAlign: 'center' },
});
