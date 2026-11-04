import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable as TouchableOpacity } from '@components/Buttons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Colors } from '@constants/colors';
import { authenticatedFetch } from '@services/apiClient';
import AppBackArrow from '@components/AppBackArrow';

const GREEN = '#218B25';
const RED = '#B76565';

type EvacuationCenter = {
  id: string;
  name: string;
  location: string;
  capacity: number;
  current_occupancy: number;
  status: 'available' | 'limited' | 'full' | 'closed';
  updated_at: string;
};

type CenterFilter = 'all' | 'available' | 'limited' | 'full' | 'closed';
type CenterSort = 'name' | 'spaces' | 'occupancy';

const CENTER_FILTERS: { key: CenterFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'available', label: 'Available' },
  { key: 'limited', label: 'Limited' },
  { key: 'full', label: 'Full' },
  { key: 'closed', label: 'Closed' },
];

export default function CenterStatusScreen() {
  const [centers, setCenters] = useState<EvacuationCenter[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<EvacuationCenter | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<CenterFilter>('all');
  const [sortBy, setSortBy] = useState<CenterSort>('name');

  const visibleCenters = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase();
    return centers
      .filter((center) => selectedFilter === 'all' || getAvailabilityKey(center) === selectedFilter)
      .filter((center) => !query || `${center.name} ${center.location}`.toLocaleLowerCase().includes(query))
      .sort((first, second) => {
        if (sortBy === 'spaces') return availableSpaces(second) - availableSpaces(first) || first.name.localeCompare(second.name);
        if (sortBy === 'occupancy') return occupancyRatio(first) - occupancyRatio(second) || first.name.localeCompare(second.name);
        return first.name.localeCompare(second.name);
      });
  }, [centers, searchText, selectedFilter, sortBy]);

  const availableSpaceTotal = visibleCenters.reduce((total, center) => total + availableSpaces(center), 0);

  const loadCenters = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    try {
      const response = await authenticatedFetch('/api/v1/centers');
      if (!response.ok) throw new Error(`Center request failed (${response.status}).`);
      const result = await response.json() as EvacuationCenter[];
      setCenters(result);
      setError('');
    } catch {
      setError('Live evacuation center information is unavailable. Check your connection and try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadCenters();
    const refresh = setInterval(() => void loadCenters(), 15000);
    return () => clearInterval(refresh);
  }, [loadCenters]));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadCenters(true)} tintColor={GREEN} colors={[GREEN]} />}
      >
        <View style={styles.header}>
          <AppBackArrow />
          <View>
            <Text style={styles.headerTitle}>CENTER STATUS</Text>
            <Text style={styles.headerSubtitle}>Live evacuation center information</Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={() => void loadCenters(true)} accessibilityRole="button" accessibilityLabel="Refresh center status">
            <MaterialCommunityIcons name="refresh" size={21} color={Colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.intro}>
          <Text style={styles.sectionTitle}>EVACUATION CENTERS</Text>
          <Text style={styles.sectionSubtitle}>View capacity, availability, and location.</Text>
        </View>

        {centers.length > 0 && <View style={styles.discovery}>
          <View style={styles.searchBox}>
            <MaterialCommunityIcons name="magnify" size={20} color={Colors.textMuted} />
            <TextInput value={searchText} onChangeText={setSearchText} placeholder="Search name or location" placeholderTextColor={Colors.textMuted} style={styles.searchInput} returnKeyType="search" accessibilityLabel="Search evacuation centers" />
            {!!searchText && <Pressable onPress={() => setSearchText('')} style={styles.clearSearch} accessibilityRole="button" accessibilityLabel="Clear search"><MaterialCommunityIcons name="close-circle" size={18} color={Colors.textMuted} /></Pressable>}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
            {CENTER_FILTERS.map((filter) => {
              const isSelected = selectedFilter === filter.key;
              return <Pressable key={filter.key} style={[styles.filterChip, isSelected && styles.filterChipSelected]} onPress={() => setSelectedFilter(filter.key)} accessibilityRole="button" accessibilityState={{ selected: isSelected }}>
                <Text style={[styles.filterText, isSelected && styles.filterTextSelected]}>{filter.label}</Text>
              </Pressable>;
            })}
          </ScrollView>
          <View style={styles.resultsRow}>
            <Text style={styles.resultCount}>{visibleCenters.length} of {centers.length} centers · {availableSpaceTotal} spaces</Text>
            <MaterialCommunityIcons name="sort" size={17} color={Colors.textMuted} />
          </View>
          <View style={styles.sortControl} accessibilityRole="radiogroup" accessibilityLabel="Sort centers">
            {([
              ['name', 'A–Z'],
              ['spaces', 'Most spaces'],
              ['occupancy', 'Least full'],
            ] as const).map(([sort, label]) => {
              const isSelected = sortBy === sort;
              return <Pressable key={sort} style={[styles.sortOption, isSelected && styles.sortOptionSelected]} onPress={() => setSortBy(sort)} accessibilityRole="radio" accessibilityState={{ checked: isSelected }}>
                <Text style={[styles.sortText, isSelected && styles.sortTextSelected]}>{label}</Text>
              </Pressable>;
            })}
          </View>
        </View>}

        {isLoading && centers.length === 0 ? (
          <View style={styles.state}><ActivityIndicator color={GREEN} /><Text style={styles.stateText}>Loading live center records...</Text></View>
        ) : error && centers.length === 0 ? (
          <View style={styles.state}>
            <MaterialCommunityIcons name="alert-circle-outline" size={30} color={RED} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => void loadCenters(true)}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
          </View>
        ) : centers.length === 0 ? (
          <Text style={styles.emptyText}>No evacuation centers are available.</Text>
        ) : visibleCenters.length === 0 ? (
          <View style={styles.noResults}>
            <MaterialCommunityIcons name="map-search-outline" size={30} color={GREEN} />
            <Text style={styles.noResultsTitle}>No matching centers</Text>
            <Text style={styles.noResultsText}>Try another search or availability filter.</Text>
            <TouchableOpacity style={styles.clearFiltersButton} onPress={() => { setSearchText(''); setSelectedFilter('all'); setSortBy('name'); }} accessibilityRole="button"><Text style={styles.clearFiltersText}>Clear search and filters</Text></TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {visibleCenters.map((center) => <CenterCard key={center.id} center={center} onDetails={() => setSelectedCenter(center)} />)}
          </View>
        )}
        {!!error && centers.length > 0 && <Text style={styles.staleMessage}>{error} Showing the last loaded records.</Text>}
      </ScrollView>

      <Modal transparent visible={!!selectedCenter} animationType="fade" onRequestClose={() => setSelectedCenter(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedCenter(null)}>
          {selectedCenter && <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedCenter.name}</Text>
              <TouchableOpacity onPress={() => setSelectedCenter(null)} accessibilityRole="button" accessibilityLabel="Close center details">
                <MaterialCommunityIcons name="close" size={22} color="#315C34" />
              </TouchableOpacity>
            </View>
            <CenterDetail icon="map-marker-outline" label="LOCATION" value={selectedCenter.location || 'Location not provided'} />
            <CenterDetail icon="account-group-outline" label="OCCUPANCY" value={`${safeOccupancy(selectedCenter)} of ${safeCapacity(selectedCenter)} people`} />
            <CenterDetail icon="check-circle-outline" label="AVAILABILITY" value={getAvailability(selectedCenter)} />
            <CenterDetail icon="clock-outline" label="LAST UPDATED" value={formatUpdated(selectedCenter.updated_at)} />
            <Text style={styles.contactNote}>Contact details are not currently available in the center records.</Text>
          </View>}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function CenterCard({ center, onDetails }: { center: EvacuationCenter; onDetails: () => void }) {
  const capacity = safeCapacity(center);
  const occupancy = safeOccupancy(center);
  const percentage = capacity > 0 ? Math.min(100, (occupancy / capacity) * 100) : 0;
  const spaces = availableSpaces(center);
  const statusKey = getAvailabilityKey(center);
  const tone = statusKey === 'available'
    ? { fg: '#1F6B2B', bg: '#E3F1E3', accent: '#2E9B3E' }
    : statusKey === 'limited'
      ? { fg: '#8A6A00', bg: '#FBF1CC', accent: '#E2B93B' }
      : { fg: '#A33A3A', bg: '#F8E1E1', accent: '#CF5A5A' };
  const statusLabel = statusKey === 'limited' ? 'Limited' : statusKey.charAt(0).toUpperCase() + statusKey.slice(1);

  return (
    <View style={styles.card}>
      <View style={[styles.cardAccent, { backgroundColor: tone.accent }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={[styles.iconCircle, { backgroundColor: tone.bg }]}>
            <MaterialCommunityIcons name={center.name.toLowerCase().includes('hall') ? 'office-building-outline' : 'home-city-outline'} size={24} color={tone.fg} />
          </View>
          <View style={styles.cardTitleBlock}>
            <Text style={styles.centerName} numberOfLines={2}>{center.name}</Text>
            <View style={styles.locationRow}><MaterialCommunityIcons name="map-marker" size={13} color={tone.fg} /><Text style={styles.location} numberOfLines={2}>{center.location || 'Location not provided'}</Text></View>
          </View>
          <View style={[styles.statusChip, { backgroundColor: tone.bg }]}><View style={[styles.statusDot, { backgroundColor: tone.accent }]} /><Text style={[styles.statusChipText, { color: tone.fg }]}>{statusLabel}</Text></View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statBox}><Text style={styles.statNumber}>{occupancy}<Text style={styles.statOf}>/{capacity}</Text></Text><Text style={styles.statCaption}>Occupied</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}><Text style={[styles.statNumber, { color: tone.fg }]}>{spaces}</Text><Text style={styles.statCaption}>Spaces left</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}><Text style={styles.statNumber}>{Math.round(percentage)}%</Text><Text style={styles.statCaption}>Full</Text></View>
        </View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: tone.accent }]} /></View>
        <TouchableOpacity style={styles.detailsButton} onPress={onDetails} accessibilityRole="button" accessibilityLabel={`View details for ${center.name}`}>
          <Text style={styles.detailsText}>View Details</Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color={Colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CenterDetail({ icon, label, value }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; value: string }) {
  return <View style={styles.detailRow}><MaterialCommunityIcons name={icon} size={17} color={GREEN} /><View style={styles.detailCopy}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View></View>;
}

function safeCapacity(center: EvacuationCenter) {
  return Math.max(0, Number(center.capacity) || 0);
}

function safeOccupancy(center: EvacuationCenter) {
  return Math.max(0, Number(center.current_occupancy) || 0);
}

function availableSpaces(center: EvacuationCenter) {
  if (center.status === 'closed' || center.status === 'full') return 0;
  return Math.max(0, safeCapacity(center) - safeOccupancy(center));
}

function occupancyRatio(center: EvacuationCenter) {
  const capacity = safeCapacity(center);
  return capacity > 0 ? safeOccupancy(center) / capacity : 1;
}

function getAvailabilityKey(center: EvacuationCenter): CenterFilter {
  if (center.status === 'closed') return 'closed';
  if (center.status === 'full' || (safeCapacity(center) > 0 && safeOccupancy(center) >= safeCapacity(center))) return 'full';
  return center.status === 'limited' ? 'limited' : 'available';
}

function getAvailability(center: EvacuationCenter) {
  if (center.status === 'closed') return 'Closed';
  if (center.status === 'full' || (safeCapacity(center) > 0 && safeOccupancy(center) >= safeCapacity(center))) return 'Full';
  if (center.status === 'limited') return 'Limited availability';
  return 'Available';
}

function formatUpdated(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
}

const styles = StyleSheet.create({
  discovery: { marginHorizontal: 14, marginBottom: 14, padding: 10, borderWidth: 1, borderColor: '#DCE8DC', borderRadius: 8, backgroundColor: '#F7FAF7' },
  searchBox: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, borderWidth: 1, borderColor: '#C9DCC9', borderRadius: 6, backgroundColor: Colors.surface },
  searchInput: { minWidth: 0, flex: 1, height: 42, padding: 0, color: Colors.text, fontSize: 13 },
  clearSearch: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  filterList: { gap: 6, paddingTop: 10, paddingBottom: 2 },
  filterChip: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: '#CFDCCF', borderRadius: 17, backgroundColor: Colors.surface },
  filterChipSelected: { borderColor: GREEN, backgroundColor: GREEN },
  filterText: { color: Colors.textMuted, fontSize: 10, fontWeight: '700' },
  filterTextSelected: { color: Colors.white },
  resultsRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 },
  resultCount: { color: Colors.textMuted, fontSize: 10, fontWeight: '700' },
  sortControl: { flexDirection: 'row', gap: 4, padding: 3, borderRadius: 6, backgroundColor: '#E8EEE8' },
  sortOption: { minHeight: 34, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderRadius: 4 },
  sortOptionSelected: { backgroundColor: Colors.surface },
  sortText: { color: Colors.textMuted, fontSize: 9, fontWeight: '700', textAlign: 'center' },
  sortTextSelected: { color: GREEN },
  noResults: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 36, borderWidth: 1, borderColor: '#DCE8DC', borderRadius: 8, backgroundColor: Colors.surface },
  noResultsTitle: { marginTop: 9, color: Colors.text, fontSize: 14, fontWeight: '800' },
  noResultsText: { marginTop: 4, color: Colors.textMuted, fontSize: 11, textAlign: 'center' },
  clearFiltersButton: { minHeight: 40, justifyContent: 'center', marginTop: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: GREEN, borderRadius: 5 },
  clearFiltersText: { color: GREEN, fontSize: 11, fontWeight: '700' },
  safe: { flex: 1, backgroundColor: Colors.surface },
  content: { flexGrow: 1, width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: 16 },
    header: { minHeight: 80, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between', backgroundColor: GREEN },
  headerTitle: { color: Colors.white, fontSize: 27, lineHeight: 31, fontWeight: '900' },
  headerSubtitle: { color: '#E1F1E1', fontSize: 10, marginTop: 2 },
  refreshButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  intro: { marginHorizontal: 14, marginTop: 7, marginBottom: 17 },
  sectionTitle: { color: Colors.text, fontSize: 20, fontWeight: '900' },
  sectionSubtitle: { color: Colors.textMuted, fontSize: 10, marginTop: 1 },
  list: { gap: 14, marginHorizontal: 14 },
  card: { flexDirection: 'row', overflow: 'hidden', borderRadius: 18, backgroundColor: Colors.surface, borderWidth: 1, borderColor: '#E1EBE1', shadowColor: '#000000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  cardAccent: { width: 6 },
  cardBody: { flex: 1, padding: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitleBlock: { flex: 1 },
  iconCircle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  centerName: { color: Colors.text, fontSize: 15, fontWeight: '900' },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 2, marginTop: 3 },
  location: { flex: 1, color: Colors.textMuted, fontSize: 10 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusChipText: { fontSize: 10, fontWeight: '800' },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F4F8F4' },
  statBox: { flex: 1, alignItems: 'center' },
  statNumber: { color: Colors.text, fontSize: 17, fontWeight: '900' },
  statOf: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },
  statCaption: { marginTop: 1, color: Colors.textMuted, fontSize: 9, fontWeight: '600' },
  statDivider: { width: 1, height: 26, backgroundColor: '#DCE6DC' },
  progressTrack: { height: 8, marginTop: 10, overflow: 'hidden', borderRadius: 4, backgroundColor: '#E6ECE6' },
  progressFill: { height: '100%', borderRadius: 4 },
  detailsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, marginTop: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: GREEN },
  detailsText: { color: Colors.white, fontSize: 12, fontWeight: '800' },
  state: { minHeight: 220, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 10 },
  stateText: { color: Colors.textMuted, fontSize: 12 },
  errorText: { color: '#A34545', fontSize: 12, textAlign: 'center' },
  retryButton: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 5, backgroundColor: GREEN },
  retryText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  emptyText: { padding: 24, color: Colors.textMuted, textAlign: 'center' },
  staleMessage: { marginHorizontal: 14, marginTop: 10, color: '#A34545', fontSize: 10 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(0, 0, 0, 0.35)' },
  modalCard: { padding: 16, borderRadius: 8, backgroundColor: Colors.surface },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  modalTitle: { flex: 1, color: Colors.text, fontSize: 17, fontWeight: '900' },
  detailRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#EDF2ED' },
  detailCopy: { flex: 1 },
  detailLabel: { color: Colors.textMuted, fontSize: 8, fontWeight: '800' },
  detailValue: { marginTop: 2, color: Colors.textMuted, fontSize: 11, fontWeight: '600' },
  contactNote: { marginTop: 9, color: Colors.textMuted, fontSize: 10, lineHeight: 15 },
});
