import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable as TouchableOpacity } from '@components/Buttons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Colors } from '@constants/colors';
import { authenticatedFetch } from '@services/apiClient';

const GREEN = '#218B25';
const AMBER = '#E2C64B';
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

export default function CenterStatusScreen() {
  const [centers, setCenters] = useState<EvacuationCenter[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<EvacuationCenter | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

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
        ) : (
          <View style={styles.list}>
            {centers.map((center) => <CenterCard key={center.id} center={center} onDetails={() => setSelectedCenter(center)} />)}
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
  const color = center.status === 'closed' || center.status === 'full' || (capacity > 0 && occupancy >= capacity)
    ? RED
    : percentage >= 60 ? AMBER : '#72A876';

  return (
    <View style={styles.card}>
      <View style={styles.iconCircle}>
        <MaterialCommunityIcons name={center.name.toLowerCase().includes('hall') ? 'office-building-outline' : 'home-outline'} size={25} color={GREEN} />
      </View>
      <Text style={styles.centerName}>{center.name}</Text>
      <View style={styles.locationRow}><MaterialCommunityIcons name="map-marker" size={13} color={GREEN} /><Text style={styles.location}>{center.location || 'Location not provided'}</Text></View>
      <View style={styles.capacityRow}>
        <Text style={styles.capacityLabel}>Capacity</Text>
        <Text style={styles.capacityValue}>{occupancy}/{capacity}</Text>
      </View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: color }]} /></View>
      <View style={styles.cardFooter}>
        <Text style={[styles.availability, { color }]}>{getAvailability(center)}</Text>
        <TouchableOpacity style={styles.detailsButton} onPress={onDetails} accessibilityRole="button">
          <Text style={styles.detailsText}>View Details</Text>
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
  safe: { flex: 1, backgroundColor: Colors.surface },
  content: { flexGrow: 1, width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: 16 },
  header: { minHeight: 80, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: GREEN },
  headerTitle: { color: Colors.white, fontSize: 27, lineHeight: 31, fontWeight: '900' },
  headerSubtitle: { color: '#E1F1E1', fontSize: 10, marginTop: 2 },
  refreshButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  intro: { marginHorizontal: 14, marginTop: 7, marginBottom: 17 },
  sectionTitle: { color: Colors.text, fontSize: 20, fontWeight: '900' },
  sectionSubtitle: { color: Colors.textMuted, fontSize: 10, marginTop: 1 },
  list: { gap: 11 },
  card: { minHeight: 160, paddingHorizontal: 8, paddingVertical: 9, borderWidth: 1, borderColor: GREEN, borderRadius: 9, backgroundColor: Colors.surface },
  iconCircle: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: GREEN, borderRadius: 20 },
  centerName: { marginTop: 7, color: Colors.text, fontSize: 14, fontWeight: '900' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  location: { color: Colors.textMuted, fontSize: 9 },
  capacityRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  capacityLabel: { color: Colors.textMuted, fontSize: 8 },
  capacityValue: { color: Colors.textMuted, fontSize: 9 },
  progressTrack: { height: 6, marginTop: 5, overflow: 'hidden', borderRadius: 4, backgroundColor: Colors.surfaceMuted },
  progressFill: { height: '100%', borderRadius: 4 },
  cardFooter: { minHeight: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  availability: { fontSize: 9, fontWeight: '800' },
  detailsButton: { minWidth: 82, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: '#72A876' },
  detailsText: { color: Colors.white, fontSize: 8, fontWeight: '600' },
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
