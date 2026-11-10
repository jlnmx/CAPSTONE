import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable as TouchableOpacity } from '@components/Buttons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Colors } from '@constants/colors';
import { authenticatedFetch } from '@services/apiClient';
import { useEvacuationCenterFeed } from '@hooks/useRealtime';
import AppBackArrow from '@components/AppBackArrow';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { AppBoldFontFamily, AppFontFamily, AppHeadingFontFamily, AppMediumFontFamily, AppSemiboldFontFamily } from '@constants/typography';

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
  const totalCapacity = centers.reduce((total, center) => total + safeCapacity(center), 0);
  const availableCenterCount = centers.filter((center) => getAvailabilityKey(center) === 'available').length;

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

  useEvacuationCenterFeed(() => void loadCenters());

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
        <LinearGradient colors={['#20862B', '#176B28']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <AppBackArrow />
          <View style={styles.headerCopy}>
            <Text style={styles.headerEyebrow}>RESIDENT SERVICES</Text>
            <Text style={styles.headerTitle}>Center status</Text>
            <Text style={styles.headerSubtitle}>Live evacuation center information</Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={() => void loadCenters(true)} accessibilityRole="button" accessibilityLabel="Refresh center status">
            <MaterialCommunityIcons name="refresh" size={21} color={Colors.white} />
          </TouchableOpacity>
        </LinearGradient>

        <Animated.View entering={FadeInDown.duration(320)} style={styles.intro}>
          <View style={styles.introCopy}>
            <Text style={styles.sectionTitle}>Find a safe place</Text>
            <Text style={styles.sectionSubtitle}>Check capacity, availability, and location before you travel.</Text>
          </View>
          <View style={styles.introIcon}><MaterialCommunityIcons name="map-marker-radius-outline" size={23} color={GREEN} /></View>
        </Animated.View>

        {centers.length > 0 && <Animated.View entering={FadeInDown.delay(50).duration(320)} style={styles.overviewCard}>
          <View style={styles.overviewLive}><View style={styles.liveDot} /><Text style={styles.overviewLiveText}>LIVE CENTER UPDATES</Text></View>
          <View style={styles.overviewStats}>
            <View style={styles.overviewStat}><Text style={styles.overviewValue}>{centers.length}</Text><Text style={styles.overviewLabel}>Centers</Text></View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewStat}><Text style={[styles.overviewValue, styles.overviewGreen]}>{availableCenterCount}</Text><Text style={styles.overviewLabel}>Available</Text></View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewStat}><Text style={styles.overviewValue}>{totalCapacity.toLocaleString()}</Text><Text style={styles.overviewLabel}>Total capacity</Text></View>
          </View>
        </Animated.View>}

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
            {visibleCenters.map((center, index) => <CenterCard key={center.id} center={center} index={index} onDetails={() => setSelectedCenter(center)} />)}
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

function CenterCard({ center, index, onDetails }: { center: EvacuationCenter; index: number; onDetails: () => void }) {
  const capacity = safeCapacity(center);
  const occupancy = safeOccupancy(center);
  const percentage = capacity > 0 ? Math.min(100, (occupancy / capacity) * 100) : 0;
  const spaces = availableSpaces(center);
  const statusKey = getAvailabilityKey(center);
  const tone = statusKey === 'available'
    ? { fg: '#1F6B2B', bg: '#E3F1E3', accent: '#2E9B3E' }
    : statusKey === 'limited'
      ? { fg: '#8A6A00', bg: '#FBF1CC', accent: '#E2B93B' }
      : statusKey === 'closed'
        ? { fg: '#5F6870', bg: '#E9EDF0', accent: '#7A8791' }
        : { fg: '#A33A3A', bg: '#F8E1E1', accent: '#CF5A5A' };
  const statusLabel = statusKey === 'limited' ? 'Limited' : statusKey.charAt(0).toUpperCase() + statusKey.slice(1);

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 55).duration(360)} style={styles.card}>
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
    </Animated.View>
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
  discovery: { marginHorizontal: 16, marginBottom: 16, padding: 13, borderWidth: 1, borderColor: '#E1EAE2', borderRadius: 18, backgroundColor: '#F8FBF8', shadowColor: '#15391D', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 9, elevation: 1 },
  searchBox: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#D7E3D8', borderRadius: 12, backgroundColor: Colors.surface },
  searchInput: { minWidth: 0, flex: 1, height: 46, padding: 0, color: Colors.text, fontFamily: AppFontFamily, fontSize: 13 },
  clearSearch: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  filterList: { gap: 6, paddingTop: 10, paddingBottom: 2 },
  filterChip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 13, borderWidth: 1, borderColor: '#D7E3D8', borderRadius: 18, backgroundColor: Colors.surface },
  filterChipSelected: { borderColor: GREEN, backgroundColor: GREEN },
  filterText: { color: Colors.textMuted, fontFamily: AppSemiboldFontFamily, fontSize: 10 },
  filterTextSelected: { color: Colors.white, fontFamily: AppBoldFontFamily },
  resultsRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 },
  resultCount: { color: Colors.textMuted, fontFamily: AppSemiboldFontFamily, fontSize: 10 },
  sortControl: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 10, backgroundColor: '#E8EEE8' },
  sortOption: { minHeight: 36, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderRadius: 8 },
  sortOptionSelected: { backgroundColor: Colors.surface },
  sortText: { color: Colors.textMuted, fontFamily: AppSemiboldFontFamily, fontSize: 9, textAlign: 'center' },
  sortTextSelected: { color: GREEN, fontFamily: AppBoldFontFamily },
  noResults: { alignItems: 'center', marginHorizontal: 16, paddingHorizontal: 24, paddingVertical: 36, borderWidth: 1, borderColor: '#E1EAE2', borderRadius: 17, backgroundColor: Colors.surface },
  noResultsTitle: { marginTop: 9, color: Colors.text, fontFamily: AppBoldFontFamily, fontSize: 14 },
  noResultsText: { marginTop: 4, color: Colors.textMuted, fontFamily: AppFontFamily, fontSize: 11, textAlign: 'center' },
  clearFiltersButton: { minHeight: 42, justifyContent: 'center', marginTop: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: GREEN, borderRadius: 11 },
  clearFiltersText: { color: GREEN, fontFamily: AppBoldFontFamily, fontSize: 11 },
  safe: { flex: 1, backgroundColor: '#F4F7F4' },
  content: { flexGrow: 1, width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: 26 },
  header: { minHeight: 106, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'space-between', borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  headerCopy: { flex: 1 },
  headerEyebrow: { color: '#DFF1DF', fontFamily: AppBoldFontFamily, fontSize: 9, letterSpacing: 1.1 },
  headerTitle: { color: Colors.white, fontFamily: AppHeadingFontFamily, fontSize: 23, marginTop: 3 },
  headerSubtitle: { color: '#E1F1E1', fontFamily: AppMediumFontFamily, fontSize: 11, marginTop: 3 },
  refreshButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)' },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 17, marginBottom: 12, padding: 15, borderWidth: 1, borderColor: '#E1EAE2', borderRadius: 17, backgroundColor: Colors.surface },
  introCopy: { flex: 1 },
  introIcon: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#EAF5EB' },
  sectionTitle: { color: Colors.text, fontFamily: AppHeadingFontFamily, fontSize: 17 },
  sectionSubtitle: { color: Colors.textMuted, fontFamily: AppFontFamily, fontSize: 11, lineHeight: 16, marginTop: 3 },
  overviewCard: { marginHorizontal: 16, marginBottom: 13, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 13, borderWidth: 1, borderColor: '#DDE9DE', borderRadius: 16, backgroundColor: '#F8FBF8' },
  overviewLive: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#329A46' },
  overviewLiveText: { color: '#507456', fontFamily: AppBoldFontFamily, fontSize: 8, letterSpacing: 0.9 },
  overviewStats: { flexDirection: 'row', alignItems: 'center', marginTop: 11 },
  overviewStat: { flex: 1, alignItems: 'center' },
  overviewValue: { color: Colors.text, fontFamily: AppHeadingFontFamily, fontSize: 17 },
  overviewGreen: { color: GREEN },
  overviewLabel: { color: Colors.textMuted, fontFamily: AppMediumFontFamily, fontSize: 9, marginTop: 2 },
  overviewDivider: { width: 1, height: 30, backgroundColor: '#DDE8DE' },
  list: { gap: 11, marginHorizontal: 16 },
  card: { flexDirection: 'row', overflow: 'hidden', borderRadius: 17, backgroundColor: Colors.surface, borderWidth: 1, borderColor: '#E1EAE2', shadowColor: '#18391E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 2 },
  cardAccent: { width: 6 },
  cardBody: { flex: 1, padding: 13 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitleBlock: { flex: 1 },
  iconCircle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  centerName: { color: Colors.text, fontFamily: AppBoldFontFamily, fontSize: 14, lineHeight: 19 },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 3, marginTop: 4 },
  location: { flex: 1, color: Colors.textMuted, fontFamily: AppFontFamily, fontSize: 10, lineHeight: 14 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusChipText: { fontFamily: AppBoldFontFamily, fontSize: 9 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: '#F4F8F4' },
  statBox: { flex: 1, alignItems: 'center' },
  statNumber: { color: Colors.text, fontFamily: AppHeadingFontFamily, fontSize: 16 },
  statOf: { color: Colors.textMuted, fontFamily: AppMediumFontFamily, fontSize: 10 },
  statCaption: { marginTop: 2, color: Colors.textMuted, fontFamily: AppMediumFontFamily, fontSize: 9 },
  statDivider: { width: 1, height: 26, backgroundColor: '#DCE6DC' },
  progressTrack: { height: 7, marginTop: 10, overflow: 'hidden', borderRadius: 4, backgroundColor: '#E6ECE6' },
  progressFill: { height: '100%', borderRadius: 4 },
  detailsButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, marginTop: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: GREEN },
  detailsText: { color: Colors.white, fontFamily: AppBoldFontFamily, fontSize: 11 },
  state: { minHeight: 220, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 10 },
  stateText: { color: Colors.textMuted, fontFamily: AppFontFamily, fontSize: 12 },
  errorText: { color: '#A34545', fontFamily: AppMediumFontFamily, fontSize: 12, textAlign: 'center' },
  retryButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 11, backgroundColor: GREEN },
  retryText: { color: Colors.white, fontFamily: AppBoldFontFamily, fontSize: 11 },
  emptyText: { padding: 24, color: Colors.textMuted, fontFamily: AppFontFamily, textAlign: 'center' },
  staleMessage: { marginHorizontal: 16, marginTop: 10, color: '#A34545', fontFamily: AppMediumFontFamily, fontSize: 10 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(13,28,17,0.48)' },
  modalCard: { padding: 18, borderRadius: 20, backgroundColor: Colors.surface },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  modalTitle: { flex: 1, color: Colors.text, fontFamily: AppHeadingFontFamily, fontSize: 17 },
  detailRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#EDF2ED' },
  detailCopy: { flex: 1 },
  detailLabel: { color: Colors.textMuted, fontFamily: AppBoldFontFamily, fontSize: 8, letterSpacing: 0.4 },
  detailValue: { marginTop: 2, color: Colors.text, fontFamily: AppMediumFontFamily, fontSize: 11 },
  contactNote: { marginTop: 9, color: Colors.textMuted, fontFamily: AppFontFamily, fontSize: 10, lineHeight: 15 },
});
