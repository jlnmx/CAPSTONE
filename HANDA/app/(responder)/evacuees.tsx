import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@constants/colors';
import { AnimatedPressable } from '@components/Buttons';
import { EvacuationStatus } from '@services/responderData';
import { authenticatedFetch } from '@services/apiClient';
import AppBackArrow from '@components/AppBackArrow';
import Avatar from '@components/Avatar';
import { KIT_GREEN as GREEN, Reveal, kitFonts } from '@components/IncidentCardKit';

const FILTERS: Array<'ALL' | EvacuationStatus> = ['ALL', 'registered', 'checked_in', 'evacuated', 'released'];
const SORT_MODES = ['recent', 'oldest', 'name', 'household'] as const;
type SortMode = typeof SORT_MODES[number];
type CenterOption = { key: string; label: string; location: string; count: number };

type CenterRegistration = {
  id: string;
  status: EvacuationStatus;
  registered_at: string;
  resident_name: string;
  resident_profile_picture?: string | null;
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

const STATUS_COLORS: Record<EvacuationStatus, string> = {
  registered: '#C47A13',
  checked_in: '#1976A7',
  evacuated: GREEN,
  released: '#667085',
};

function statusLabel(status: EvacuationStatus): string {
  return status.replace('_', ' ');
}

function registrationDate(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function EvacueesScreen() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<typeof FILTERS[number]>('ALL');
  const [centerFilter, setCenterFilter] = useState('ALL');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [registrations, setRegistrations] = useState<CenterRegistration[]>([]);
  const [registrationError, setRegistrationError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const response = await authenticatedFetch('/api/v1/evacuation-registrations?include_released=true');
      if (!response.ok) throw new Error('Registered evacuees could not be loaded. Pull down to retry.');
      const records = await response.json() as CenterRegistration[];
      if (!Array.isArray(records)) throw new Error('The server returned an invalid evacuee list.');
      setRegistrations(records.map((record) => ({ ...record, members: Array.isArray(record.members) ? record.members : [] })));
      setRegistrationError('');
    } catch (error) {
      setRegistrationError(error instanceof Error ? error.message : 'Registered evacuees could not be loaded. Pull down to retry.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = setInterval(() => void load(true), 15000);
    return () => clearInterval(refresh);
  }, [load]);

  const centerOptions = useMemo<CenterOption[]>(() => {
    const centers = new Map<string, CenterOption>();
    registrations.forEach((registration) => {
      const key = getCenterKey(registration);
      const existing = centers.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        centers.set(key, { key, label: registration.center_name || 'Center unavailable', location: registration.center_location, count: 1 });
      }
    });
    return Array.from(centers.values()).sort((left, right) => left.label.localeCompare(right.label));
  }, [registrations]);

  const statusCounts = useMemo(() => registrations.reduce<Record<string, number>>((counts, registration) => {
    counts.ALL = (counts.ALL ?? 0) + 1;
    counts[registration.status] = (counts[registration.status] ?? 0) + 1;
    return counts;
  }, {}), [registrations]);

  const totalPeople = useMemo(() => registrations.reduce((total, registration) => total + Math.max(0, Number(registration.household_size) || 0), 0), [registrations]);

  const visibleRegistrations = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return registrations
      .filter((registration) => filter === 'ALL' || registration.status === filter)
      .filter((registration) => centerFilter === 'ALL' || getCenterKey(registration) === centerFilter)
      .filter((registration) => {
        if (!query) return true;
        const searchable = [
          getRegistrationName(registration),
          registration.resident_name,
          registration.contact_number,
          registration.address,
          registration.center_name,
          registration.center_location,
          registration.status,
          ...registration.members.flatMap((member) => [member.name, member.relationship]),
        ].join(' ').toLocaleLowerCase();
        return searchable.includes(query);
      })
      .sort((left, right) => {
        if (sortMode === 'name') return getRegistrationName(left).localeCompare(getRegistrationName(right));
        if (sortMode === 'household') return right.household_size - left.household_size || getRegistrationName(left).localeCompare(getRegistrationName(right));
        const dateDifference = registrationDate(right.registered_at) - registrationDate(left.registered_at);
        return sortMode === 'oldest' ? -dateDifference : dateDifference;
      });
  }, [registrations, filter, centerFilter, search, sortMode]);

  const updateStatus = async (registration: CenterRegistration, nextStatus: EvacuationStatus) => {
    if (updatingId) return;
    setUpdatingId(registration.id);
    try {
      const response = await authenticatedFetch(`/api/v1/evacuation-registrations/${encodeURIComponent(registration.id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        const error = await response.json() as { detail?: unknown };
        throw new Error(typeof error.detail === 'string' ? error.detail : `Status update failed (${response.status}).`);
      }
      setRegistrations((current) => current.map((item) => item.id === registration.id ? { ...item, status: nextStatus } : item));
    } catch (error) {
      Alert.alert('Status update failed', error instanceof Error ? error.message : 'The status was not saved.');
    } finally {
      setUpdatingId(null);
    }
  };

  const cycleSort = () => {
    const index = SORT_MODES.indexOf(sortMode);
    setSortMode(SORT_MODES[(index + 1) % SORT_MODES.length]);
  };

  return <SafeAreaView style={styles.safeArea}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={GREEN} colors={[GREEN]} />}
    >
      <LinearGradient colors={['#218B25', '#176B1D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroTop}><AppBackArrow /><Text style={styles.eyebrow}>FIELD OPERATIONS</Text></View>
        <Text style={styles.title}>Evacuees</Text>
        <Text style={styles.subtitle}>Manage shelter registrations and household check-ins.</Text>
        <View style={styles.summaryRow}>
          <Summary icon="account-group-outline" label="HOUSEHOLDS" value={String(registrations.length)} />
          <View style={styles.summaryDivider} />
          <Summary icon="account-multiple-outline" label="PEOPLE" value={String(totalPeople)} />
          <View style={styles.summaryDivider} />
          <Summary icon="home-group" label="CENTERS" value={String(centerOptions.length)} />
        </View>
      </LinearGradient>

      <View style={styles.controls}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color={GREEN} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search people, contact, address, center..."
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
            accessibilityLabel="Search evacuees"
          />
          {!!search && <AnimatedPressable onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Clear search" style={styles.clearSearch}><MaterialCommunityIcons name="close-circle" size={18} color={Colors.textMuted} /></AnimatedPressable>}
        </View>

        <View style={styles.sectionHeading}>
          <View><Text style={styles.sectionTitle}>Registration status</Text><Text style={styles.sectionHint}>{visibleRegistrations.length} of {registrations.length} households</Text></View>
          <AnimatedPressable style={styles.sortButton} onPress={cycleSort} accessibilityRole="button" accessibilityLabel={`Sort by ${sortLabel(sortMode)}. Tap to change sort.`}>
            <MaterialCommunityIcons name={sortIcon(sortMode)} size={16} color={GREEN} />
            <Text style={styles.sortText}>{sortLabel(sortMode)}</Text>
          </AnimatedPressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((item) => {
            const selected = filter === item;
            const count = statusCounts[item] ?? 0;
            return <AnimatedPressable key={item} style={[styles.filterChip, selected && styles.activeFilter]} onPress={() => setFilter(item)} accessibilityRole="button" accessibilityState={{ selected }}>
              <Text style={[styles.filterText, selected && styles.activeFilterText]}>{item === 'ALL' ? 'All' : statusLabel(item)}</Text>
              <Text style={[styles.filterCount, selected && styles.activeFilterText]}>{count}</Text>
            </AnimatedPressable>;
          })}
        </ScrollView>

        {centerOptions.length > 0 && <>
          <View style={styles.centerHeading}><MaterialCommunityIcons name="map-marker-radius-outline" size={16} color={GREEN} /><Text style={styles.sectionTitle}>Filter by center</Text></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.centerFilters}>
            <AnimatedPressable style={[styles.centerChip, centerFilter === 'ALL' && styles.activeCenterChip]} onPress={() => setCenterFilter('ALL')} accessibilityRole="button" accessibilityState={{ selected: centerFilter === 'ALL' }}>
              <Text style={[styles.centerChipText, centerFilter === 'ALL' && styles.activeCenterChipText]}>All centers</Text>
              <Text style={[styles.centerCount, centerFilter === 'ALL' && styles.activeCenterChipText]}>{registrations.length}</Text>
            </AnimatedPressable>
            {centerOptions.map((center) => {
              const selected = centerFilter === center.key;
              return <AnimatedPressable key={center.key} style={[styles.centerChip, selected && styles.activeCenterChip]} onPress={() => setCenterFilter(center.key)} accessibilityRole="button" accessibilityState={{ selected }}>
                <Text style={[styles.centerChipText, selected && styles.activeCenterChipText]} numberOfLines={1}>{center.label}</Text>
                <Text style={[styles.centerCount, selected && styles.activeCenterChipText]}>{center.count}</Text>
              </AnimatedPressable>;
            })}
          </ScrollView>
        </>}
      </View>

      <View style={styles.list}>
        {isLoading && <View style={styles.messageCard}><Text style={styles.messageTitle}>Loading evacuees</Text><Text style={styles.messageText}>Fetching the latest shelter registrations...</Text></View>}
        {!isLoading && !!registrationError && <View style={styles.messageCard}>
          <MaterialCommunityIcons name="alert-circle-outline" size={24} color="#B42318" />
          <Text style={styles.messageTitle}>Could not load registrations</Text>
          <Text style={styles.messageText}>{registrationError}</Text>
          <AnimatedPressable style={styles.retryButton} onPress={() => void load()} accessibilityRole="button"><Text style={styles.retryText}>Try again</Text></AnimatedPressable>
        </View>}
        {!isLoading && !registrationError && visibleRegistrations.map((registration, index) => <Reveal index={index} key={registration.id}>
          <RegistrationRow
            registration={registration}
            expanded={expandedId === registration.id}
            updating={updatingId === registration.id}
            onPress={() => setExpandedId(expandedId === registration.id ? null : registration.id)}
            onStatusChange={(status) => void updateStatus(registration, status)}
          />
        </Reveal>)}
        {!isLoading && !registrationError && visibleRegistrations.length === 0 && <View style={styles.messageCard}>
          <MaterialCommunityIcons name={search || filter !== 'ALL' || centerFilter !== 'ALL' ? 'filter-off-outline' : 'account-search-outline'} size={26} color={Colors.textMuted} />
          <Text style={styles.messageTitle}>{registrations.length ? 'No matching households' : 'No registrations yet'}</Text>
          <Text style={styles.messageText}>{registrations.length ? 'Try another search or clear one of the selected filters.' : 'New evacuation registrations will appear here.'}</Text>
          {(search || filter !== 'ALL' || centerFilter !== 'ALL') && <AnimatedPressable style={styles.retryButton} onPress={() => { setSearch(''); setFilter('ALL'); setCenterFilter('ALL'); }} accessibilityRole="button"><Text style={styles.retryText}>Clear filters</Text></AnimatedPressable>}
        </View>}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function Summary({ icon, label, value }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; value: string }) {
  return <View style={styles.summaryItem}>
    <MaterialCommunityIcons name={icon} size={17} color="#FFFFFF" />
    <View><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>
  </View>;
}

function sortLabel(mode: SortMode): string {
  return mode === 'recent' ? 'Newest' : mode === 'oldest' ? 'Oldest' : mode === 'name' ? 'Name' : 'Household';
}

function sortIcon(mode: SortMode): React.ComponentProps<typeof MaterialCommunityIcons>['name'] {
  return mode === 'name' ? 'sort-alphabetical-ascending' : mode === 'household' ? 'account-multiple' : 'sort-clock-ascending';
}

function getRegistrationName(registration: CenterRegistration): string {
  return [registration.first_name, registration.middle_name, registration.last_name].filter(Boolean).join(' ').trim() || registration.resident_name || 'Unnamed registrant';
}

function getCenterKey(registration: Pick<CenterRegistration, 'center_name' | 'center_location'>): string {
  return `${registration.center_name}|${registration.center_location}`.toLocaleLowerCase();
}

function nextStatusFor(status: EvacuationStatus): EvacuationStatus | null {
  return status === 'registered' ? 'checked_in' : status === 'checked_in' ? 'evacuated' : status === 'evacuated' ? 'released' : null;
}

function RegistrationRow({ registration, expanded, updating, onPress, onStatusChange }: { registration: CenterRegistration; expanded: boolean; updating: boolean; onPress: () => void; onStatusChange: (status: EvacuationStatus) => void }) {
  const name = getRegistrationName(registration);
  const nextStatus = nextStatusFor(registration.status);
  const color = STATUS_COLORS[registration.status];
  return <View style={styles.registrationCard}>
    <View style={[styles.statusAccent, { backgroundColor: color }]} />
    <Pressable onPress={onPress} style={styles.registrationRow} accessibilityRole="button" accessibilityLabel={`View ${name}`} accessibilityState={{ expanded }}>
      <Avatar uri={registration.resident_profile_picture} name={name} size={46} />
      <View style={styles.rowCopy}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <View style={styles.metaRow}><MaterialCommunityIcons name="account-multiple-outline" size={13} color={Colors.textMuted} /><Text style={styles.details}>{registration.household_size} {registration.household_size === 1 ? 'person' : 'people'}</Text></View>
        <View style={styles.metaRow}><MaterialCommunityIcons name="map-marker-outline" size={13} color={Colors.textMuted} /><Text style={styles.details} numberOfLines={1}>{registration.center_name || 'Center unavailable'}</Text></View>
      </View>
      <View style={styles.rowRight}>
        <View style={[styles.statusPill, { backgroundColor: `${color}18` }]}><View style={[styles.statusDot, { backgroundColor: color }]} /><Text style={[styles.statusText, { color }]}>{statusLabel(registration.status)}</Text></View>
        <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textMuted} />
      </View>
    </Pressable>
    {nextStatus && <AnimatedPressable style={styles.verifyButton} onPress={() => onStatusChange(nextStatus)} disabled={updating} accessibilityRole="button" accessibilityLabel={`${registration.status === 'registered' ? 'Verify check-in' : `Mark ${statusLabel(nextStatus)}`} for ${name}`}>
      <MaterialCommunityIcons name={registration.status === 'registered' ? 'check-decagram-outline' : 'arrow-right-circle-outline'} size={16} color={GREEN} />
      <Text style={styles.verifyText}>{updating ? 'Updating...' : registration.status === 'registered' ? 'Verify check-in' : `Mark ${statusLabel(nextStatus)}`}</Text>
    </AnimatedPressable>}
    {expanded && <Reveal index={0}><View style={styles.detailsPanel}>
      <Text style={styles.panelTitle}>Registrant information</Text>
      <Detail label="Age" value={String(registration.age)} />
      <Detail label="Sex" value={registration.sex} />
      <Detail label="Contact" value={registration.contact_number} />
      <Detail label="Address" value={registration.address} />
      <Detail label="Center location" value={registration.center_location} />
      <Text style={[styles.panelTitle, styles.householdHeading]}>Household members <Text style={styles.memberCount}>{registration.members.length}</Text></Text>
      {registration.members.length === 0 ? <Text style={styles.memberRelation}>No additional household members.</Text> : registration.members.map((member) => <View style={styles.member} key={member.id}>
        <View style={styles.memberIcon}><MaterialCommunityIcons name="account-outline" size={16} color={GREEN} /></View>
        <View style={styles.memberCopy}><Text style={styles.memberName}>{member.name}</Text><Text style={styles.memberRelation}>{member.relationship}</Text></View>
      </View>)}
    </View></Reveal>}
  </View>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value || 'Not provided'}</Text></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: 34 },
  hero: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eyebrow: { color: 'rgba(255,255,255,0.78)', fontFamily: kitFonts.bold, fontSize: 9, letterSpacing: 1.8 },
  title: { color: '#FFFFFF', fontFamily: kitFonts.heading, fontSize: 28, marginTop: 10 },
  subtitle: { color: 'rgba(255,255,255,0.86)', fontFamily: kitFonts.medium, fontSize: 12, lineHeight: 18, marginTop: 3 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, paddingHorizontal: 2 },
  summaryItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  summaryValue: { color: '#FFFFFF', fontFamily: kitFonts.heading, fontSize: 17 },
  summaryLabel: { color: 'rgba(255,255,255,0.76)', fontFamily: kitFonts.bold, fontSize: 8, letterSpacing: 0.6, marginTop: 1 },
  summaryDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.25)' },
  controls: { paddingHorizontal: 15, paddingTop: 17 },
  searchBar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, borderRadius: 15, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  searchInput: { flex: 1, minWidth: 0, color: Colors.text, fontFamily: kitFonts.medium, fontSize: 12, paddingVertical: 11 },
  clearSearch: { width: 30, height: 36, alignItems: 'center', justifyContent: 'center' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 19, marginBottom: 10 },
  sectionTitle: { color: Colors.text, fontFamily: kitFonts.bold, fontSize: 12 },
  sectionHint: { color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 10, marginTop: 2 },
  sortButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderWidth: 1, borderColor: Colors.border, borderRadius: 11, backgroundColor: Colors.surface },
  sortText: { color: GREEN, fontFamily: kitFonts.bold, fontSize: 10 },
  filters: { gap: 7, paddingRight: 15 },
  filterChip: { minHeight: 35, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  activeFilter: { backgroundColor: GREEN, borderColor: GREEN },
  filterText: { color: Colors.textMuted, fontFamily: kitFonts.semibold, fontSize: 10, textTransform: 'capitalize' },
  activeFilterText: { color: '#FFFFFF' },
  filterCount: { color: Colors.textMuted, fontFamily: kitFonts.bold, fontSize: 9 },
  centerHeading: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, marginBottom: 8 },
  centerFilters: { gap: 7, paddingRight: 15 },
  centerChip: { maxWidth: 210, minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, borderRadius: 11, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  activeCenterChip: { backgroundColor: '#E8F4E8', borderColor: '#A8D0A8' },
  centerChipText: { flexShrink: 1, color: Colors.textMuted, fontFamily: kitFonts.semibold, fontSize: 10 },
  activeCenterChipText: { color: GREEN },
  centerCount: { color: Colors.textMuted, fontFamily: kitFonts.bold, fontSize: 9 },
  list: { gap: 10, paddingHorizontal: 15, paddingTop: 14 },
  registrationCard: { position: 'relative', overflow: 'hidden', padding: 12, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, shadowColor: '#173A20', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  statusAccent: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 4 },
  registrationRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 3 },
  rowCopy: { flex: 1, minWidth: 0, gap: 3 },
  name: { color: Colors.text, fontFamily: kitFonts.heading, fontSize: 13 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  details: { flexShrink: 1, color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 10 },
  rowRight: { alignItems: 'flex-end', justifyContent: 'center', gap: 5 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 999 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: kitFonts.bold, fontSize: 8, textTransform: 'capitalize' },
  verifyButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 9, marginLeft: 55, borderRadius: 11, backgroundColor: '#EAF4EA' },
  verifyText: { color: GREEN, fontFamily: kitFonts.bold, fontSize: 10, textTransform: 'capitalize' },
  detailsPanel: { paddingTop: 13, paddingLeft: 56, marginTop: 11, borderTopWidth: 1, borderTopColor: Colors.border },
  panelTitle: { color: Colors.text, fontFamily: kitFonts.bold, fontSize: 11, marginBottom: 7 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 5 },
  detailLabel: { color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 10 },
  detailValue: { flex: 1, color: Colors.text, fontFamily: kitFonts.semibold, fontSize: 10, textAlign: 'right' },
  householdHeading: { marginTop: 13 },
  memberCount: { color: GREEN, fontFamily: kitFonts.bold, fontSize: 10 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderTopWidth: 1, borderTopColor: Colors.border },
  memberIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#EAF4EA' },
  memberCopy: { flex: 1 },
  memberName: { color: Colors.text, fontFamily: kitFonts.semibold, fontSize: 10 },
  memberRelation: { color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 9, marginTop: 2 },
  messageCard: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 25, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, backgroundColor: Colors.surface },
  messageTitle: { color: Colors.text, fontFamily: kitFonts.heading, fontSize: 13, textAlign: 'center', marginTop: 7 },
  messageText: { color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 4 },
  retryButton: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 15, marginTop: 12, borderRadius: 11, backgroundColor: '#EAF4EA' },
  retryText: { color: GREEN, fontFamily: kitFonts.bold, fontSize: 10 },
});
