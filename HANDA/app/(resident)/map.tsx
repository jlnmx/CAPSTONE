import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { ThemedText as Text } from '@components/ThemedText';
import AppBackArrow from '@components/AppBackArrow';
import { AnimatedPressable } from '@components/Buttons';
import LeafletMap from '@components/LeafletMap';
import { Reveal, kitFonts } from '@components/IncidentCardKit';
import { Colors } from '@constants/colors';
import { useTheme } from '@hooks/useTheme';
import { fetchJsonWithCache } from '@services/offlineCache';
import type { MapEvacuationCenter } from '@/types/index';
import type { MapNavigationTarget } from '@components/MapNavigation.types';

const GREEN = '#218B25';

export default function ResidentMapScreen() {
  const { palette } = useTheme();
  const [centers, setCenters] = useState<MapEvacuationCenter[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<MapEvacuationCenter | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<MapNavigationTarget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCenters = useCallback(async () => {
    try {
      const { data, fromCache } = await fetchJsonWithCache<MapEvacuationCenter[]>('/api/v1/centers');
      setCenters(data);
      setError(fromCache ? 'Offline: showing saved evacuation center information.' : '');
    } catch {
      setError('Evacuation center locations are unavailable. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadCenters();
    const refresh = setInterval(() => void loadCenters(), 15_000);
    return () => clearInterval(refresh);
  }, [loadCenters]));

  const selectCenter = useCallback((centerId: string) => {
    setSelectedCenter(centers.find((center) => center.id === centerId) ?? null);
  }, [centers]);
  const capacity = selectedCenter ? Math.max(0, Number(selectedCenter.capacity) || 0) : 0;
  const occupancy = selectedCenter ? Math.max(0, Number(selectedCenter.current_occupancy) || 0) : 0;
  const spaces = Math.max(0, capacity - occupancy);
  const availability = selectedCenter?.status === 'closed'
    ? 'Closed'
    : selectedCenter?.status === 'full' || spaces === 0
      ? 'Full'
      : selectedCenter?.status === 'limited'
        ? 'Limited availability'
        : 'Spaces available';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <AppBackArrow />
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>COMMUNITY INFORMATION</Text>
            <Text style={styles.title}>Evacuation map</Text>
            <Text style={styles.subtitle}>Center locations and live availability</Text>
          </View>
          <View style={styles.headerIcon}><MaterialCommunityIcons name="map-marker-radius-outline" size={22} color={Colors.white} /></View>
        </View>

        <Reveal index={0}>
          <View style={[styles.notice, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={styles.noticeIcon}><MaterialCommunityIcons name="information-outline" size={20} color={GREEN} /></View>
            <Text style={[styles.noticeText, { color: palette.text }]}>
              Evacuation assignments are managed by City Social Welfare and Development. Responders will direct you to the appropriate center; viewing a center here does not register or assign your household.
            </Text>
          </View>
        </Reveal>

        <View style={[styles.mapFrame, { borderColor: palette.border }]}>
          {isLoading && centers.length === 0 ? (
            <View style={[styles.mapState, { backgroundColor: palette.surfaceMuted }]}><ActivityIndicator color={GREEN} /><Text style={[styles.stateText, { color: palette.textMuted }]}>Loading center locations...</Text></View>
          ) : (
            <LeafletMap
              centers={centers}
              onSelectCenter={selectCenter}
              navigationTarget={navigationTarget}
              onNavigationTargetChange={setNavigationTarget}
            />
          )}
        </View>
        {!!error && <Text style={[styles.error, { color: palette.textMuted }]}>{error}</Text>}

        <View style={styles.footerRow}>
          <MaterialCommunityIcons name="gesture-tap" size={18} color={GREEN} />
          <Text style={[styles.footerText, { color: palette.textMuted }]}>Search or tap an evacuation center, then choose Navigate for in-app routes and directions.</Text>
        </View>
      </ScrollView>

      <Modal transparent visible={!!selectedCenter} animationType="fade" onRequestClose={() => setSelectedCenter(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedCenter(null)}>
          {selectedCenter && (
            <Pressable style={[styles.modalCard, { backgroundColor: palette.surface }]} onPress={(event) => event.stopPropagation()}>
              <View style={styles.modalHeading}>
                <View style={styles.centerIcon}><MaterialCommunityIcons name="home-city-outline" size={22} color={GREEN} /></View>
                <View style={styles.modalTitleCopy}>
                  <Text style={[styles.modalTitle, { color: palette.text }]}>{selectedCenter.name}</Text>
                  <Text style={[styles.modalLocation, { color: palette.textMuted }]}>{selectedCenter.location || 'Location not provided'}</Text>
                </View>
                <AnimatedPressable onPress={() => setSelectedCenter(null)} accessibilityRole="button" accessibilityLabel="Close center information">
                  <MaterialCommunityIcons name="close" size={22} color={palette.textMuted} />
                </AnimatedPressable>
              </View>
              <View style={[styles.availability, { backgroundColor: selectedCenter.status === 'closed' || availability === 'Full' ? '#FCE8E6' : '#E8F4E8' }]}>
                <View style={[styles.availabilityDot, { backgroundColor: selectedCenter.status === 'closed' || availability === 'Full' ? Colors.emergency : GREEN }]} />
                <Text style={[styles.availabilityText, { color: selectedCenter.status === 'closed' || availability === 'Full' ? Colors.emergency : GREEN }]}>{availability}</Text>
              </View>
              <View style={styles.stats}>
                <View style={[styles.stat, { backgroundColor: palette.background }]}><Text style={[styles.statValue, { color: palette.text }]}>{occupancy} / {capacity}</Text><Text style={[styles.statLabel, { color: palette.textMuted }]}>People at center</Text></View>
                <View style={[styles.stat, { backgroundColor: palette.background }]}><Text style={[styles.statValue, { color: palette.text }]}>{spaces}</Text><Text style={[styles.statLabel, { color: palette.textMuted }]}>Spaces remaining</Text></View>
              </View>
              {selectedCenter.latitude != null && selectedCenter.longitude != null ? (
                <Pressable
                  onPress={() => {
                    setNavigationTarget({
                      title: selectedCenter.name,
                      latitude: Number(selectedCenter.latitude),
                      longitude: Number(selectedCenter.longitude),
                    });
                    setSelectedCenter(null);
                  }}
                  style={styles.navigateButton}
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons name="navigation-variant" size={18} color={Colors.white} />
                  <Text style={styles.navigateButtonText}>Navigate</Text>
                </Pressable>
              ) : null}
              <Text style={[styles.assignmentNote, { color: palette.textMuted }]}>This information is for reference only. Responders and City Social Welfare and Development personnel coordinate center assignments.</Text>
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: 24 },
  header: { minHeight: 112, paddingHorizontal: 18, paddingVertical: 16, backgroundColor: GREEN, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerCopy: { flex: 1 },
  eyebrow: { color: 'rgba(255,255,255,0.78)', fontFamily: kitFonts.bold, fontSize: 9, letterSpacing: 1.4 },
  title: { color: Colors.white, fontFamily: kitFonts.heading, fontSize: 22, marginTop: 3 },
  subtitle: { color: 'rgba(255,255,255,0.84)', fontFamily: kitFonts.medium, fontSize: 11, marginTop: 3 },
  headerIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.17)', alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, margin: 15, padding: 13, borderRadius: 16, borderWidth: 1 },
  noticeIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: 'rgba(33,139,37,0.1)', alignItems: 'center', justifyContent: 'center' },
  noticeText: { flex: 1, fontFamily: kitFonts.medium, fontSize: 12, lineHeight: 18, paddingTop: 1 },
  mapFrame: { height: 560, marginHorizontal: 15, overflow: 'hidden', borderWidth: 1, borderRadius: 20 },
  mapState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  stateText: { fontFamily: kitFonts.medium, fontSize: 12 },
  error: { marginHorizontal: 18, marginTop: 8, fontFamily: kitFonts.medium, fontSize: 11 },
  footerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 19, paddingTop: 13 },
  footerText: { flex: 1, fontFamily: kitFonts.medium, fontSize: 11, lineHeight: 16 },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 24, backgroundColor: 'rgba(0,0,0,0.48)' },
  modalCard: { width: '100%', maxWidth: 430, maxHeight: '90%', padding: 18, borderRadius: 21, elevation: 12 },
  modalHeading: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  centerIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(33,139,37,0.1)' },
  modalTitleCopy: { flex: 1 },
  modalTitle: { fontFamily: kitFonts.heading, fontSize: 17, lineHeight: 22, flexShrink: 1 },
  modalLocation: { fontFamily: kitFonts.medium, fontSize: 11, lineHeight: 16, marginTop: 3 },
  availability: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10, marginTop: 18 },
  availabilityDot: { width: 7, height: 7, borderRadius: 4 },
  availabilityText: { fontFamily: kitFonts.bold, fontSize: 11 },
  stats: { flexDirection: 'row', gap: 9, marginTop: 13 },
  navigateButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, borderRadius: 13, backgroundColor: GREEN },
  navigateButtonText: { color: Colors.white, fontFamily: kitFonts.bold, fontSize: 14 },
  stat: { flex: 1, minWidth: 0, padding: 12, borderRadius: 13 },
  statValue: { fontFamily: kitFonts.heading, fontSize: 17 },
  statLabel: { fontFamily: kitFonts.medium, fontSize: 10, marginTop: 3 },
  assignmentNote: { fontFamily: kitFonts.medium, fontSize: 11, lineHeight: 17, marginTop: 13 },
});
