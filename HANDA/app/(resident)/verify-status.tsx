import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable } from '@components/Buttons';
import { GradientHeader, Reveal, kitFonts } from '@components/ScreenKit';
import { Colors } from '@constants/colors';
import { useTheme } from '@hooks/useTheme';
import { authenticatedFetch } from '@services/apiClient';

const GREEN = '#218B25';

type EvacuationStatus = {
  resident: { id: string; name: string; status: string };
  registrationId: string | null;
  status: string;
  center: { id: string; name: string; location: string } | null;
  registeredAt: string | null;
  checkedInAt: string | null;
  checkedInBy: string | null;
  householdCount: number;
  evacuee: { name: string; age: number; sex: string; contactNumber: string; address: string } | null;
  members: Array<{ id: string; name: string; relationship: string; status: string }>;
};

export default function VerifyStatusScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const [status, setStatus] = useState<EvacuationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadStatus = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    try {
      const response = await authenticatedFetch('/api/v1/resident/evacuation-status');
      if (!response.ok) throw new Error('Evacuation status could not be loaded.');
      setStatus(await response.json() as EvacuationStatus);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Live evacuation status is unavailable.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadStatus();
    const refresh = setInterval(() => void loadStatus(), 15_000);
    return () => clearInterval(refresh);
  }, [loadStatus]));

  const assigned = !!status?.registrationId;
  const statusLabel = status?.status === 'checked_in'
    ? 'Checked in'
    : status?.status === 'evacuated'
      ? 'Evacuated'
      : status?.status === 'released'
        ? 'Released'
        : 'Registered';
  const statusTone = status?.status === 'checked_in' ? GREEN : status?.status === 'evacuated' ? '#9A6700' : '#56705A';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadStatus(true)} tintColor={GREEN} colors={[GREEN]} />}
      >
        <GradientHeader title="My evacuation status" subtitle="Updates from evacuation personnel" icon="shield-check" />

        {isLoading && !status ? (
          <View style={styles.state}><ActivityIndicator color={GREEN} /><Text style={[styles.stateText, { color: palette.textMuted }]}>Loading your latest status...</Text></View>
        ) : error && !status ? (
          <View style={[styles.stateCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <MaterialCommunityIcons name="clock-alert-outline" size={30} color={Colors.emergency} />
            <Text style={[styles.stateTitle, { color: palette.text }]}>Status unavailable</Text>
            <Text style={[styles.stateText, { color: palette.textMuted }]}>{error}</Text>
            <AnimatedPressable style={styles.primaryButton} onPress={() => void loadStatus(true)} accessibilityRole="button">
              <MaterialCommunityIcons name="refresh" size={17} color={Colors.white} /><Text style={styles.primaryText}>Try again</Text>
            </AnimatedPressable>
          </View>
        ) : !assigned ? (
          <Reveal index={0}>
            <View style={[styles.guidanceCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <View style={styles.guidanceIcon}><MaterialCommunityIcons name="account-clock-outline" size={27} color={GREEN} /></View>
              <Text style={[styles.guidanceTitle, { color: palette.text }]}>No center assignment yet</Text>
              <Text style={[styles.guidanceText, { color: palette.textMuted }]}>
                You do not need to register or choose a center in the app. City Social Welfare and Development personnel manage evacuation records and center assignments. Follow responder directions during an evacuation.
              </Text>
              <View style={[styles.guidanceNote, { backgroundColor: palette.background }]}>
                <MaterialCommunityIcons name="bell-outline" size={18} color={GREEN} />
                <Text style={[styles.guidanceNoteText, { color: palette.textMuted }]}>If an assigned center becomes full, responders will provide updated instructions.</Text>
              </View>
            </View>
          </Reveal>
        ) : status ? (
          <>
            <Reveal index={0}>
              <View style={[styles.statusCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <View style={styles.statusHeading}>
                  <View style={styles.statusIcon}><MaterialCommunityIcons name="home-city-outline" size={23} color={GREEN} /></View>
                  <View style={styles.statusCopy}>
                    <Text style={[styles.cardEyebrow, { color: palette.textMuted }]}>CURRENT ASSIGNMENT</Text>
                    <Text style={[styles.centerName, { color: palette.text }]}>{status.center?.name || 'Evacuation center'}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: `${statusTone}18` }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusTone }]} />
                    <Text style={[styles.statusLabel, { color: statusTone }]}>{statusLabel}</Text>
                  </View>
                </View>
                <View style={[styles.divider, { backgroundColor: palette.border }]} />
                <InfoRow icon="map-marker-outline" label="LOCATION" value={status.center?.location || 'Location not provided'} palette={palette} />
                <InfoRow icon="account-group-outline" label="HOUSEHOLD" value={`${Math.max(1, status.householdCount)} ${status.householdCount === 1 ? 'person' : 'people'}`} palette={palette} />
                <InfoRow icon="calendar-clock-outline" label="RECORDED" value={formatDate(status.registeredAt)} palette={palette} />
                {status.checkedInAt && <InfoRow icon="check-circle-outline" label="CHECKED IN" value={`${formatDate(status.checkedInAt)}${status.checkedInBy ? ` · ${status.checkedInBy}` : ''}`} palette={palette} />}
              </View>
            </Reveal>

            {status.evacuee && (
              <Reveal index={1}>
                <View style={[styles.householdCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  <Text style={[styles.sectionTitle, { color: palette.text }]}>Household record</Text>
                  <PersonRow name={status.evacuee.name} relationship="Household lead" palette={palette} />
                  {status.members.map((member) => <PersonRow key={member.id} name={member.name} relationship={member.relationship} palette={palette} />)}
                </View>
              </Reveal>
            )}
          </>
        ) : null}

        <Reveal index={assigned ? 2 : 1}>
          <AnimatedPressable style={[styles.directoryButton, { backgroundColor: palette.surface, borderColor: palette.border }]} onPress={() => router.push('/(resident)/center-status')} accessibilityRole="button">
            <View style={styles.directoryIcon}><MaterialCommunityIcons name="map-marker-radius-outline" size={20} color={GREEN} /></View>
            <View style={styles.directoryCopy}>
              <Text style={[styles.directoryTitle, { color: palette.text }]}>View center availability</Text>
              <Text style={[styles.directorySubtitle, { color: palette.textMuted }]}>See live capacity information for local centers</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={palette.textMuted} />
          </AnimatedPressable>
        </Reveal>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value, palette }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; value: string; palette: ReturnType<typeof useTheme>['palette'] }) {
  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name={icon} size={17} color={GREEN} />
      <View style={styles.infoCopy}>
        <Text style={[styles.cardEyebrow, { color: palette.textMuted }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: palette.text }]}>{value}</Text>
      </View>
    </View>
  );
}

function PersonRow({ name, relationship, palette }: { name: string; relationship: string; palette: ReturnType<typeof useTheme>['palette'] }) {
  return (
    <View style={[styles.personRow, { borderBottomColor: palette.border }]}>
      <View style={styles.personIcon}><MaterialCommunityIcons name="account-outline" size={18} color={GREEN} /></View>
      <View style={styles.personCopy}>
        <Text style={[styles.personName, { color: palette.text }]}>{name}</Text>
        <Text style={[styles.personRelation, { color: palette.textMuted }]}>{relationship}</Text>
      </View>
    </View>
  );
}

function formatDate(value: string | null) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: 28 },
  state: { alignItems: 'center', justifyContent: 'center', gap: 9, padding: 28 },
  stateCard: { alignItems: 'center', margin: 16, padding: 22, borderWidth: 1, borderRadius: 20 },
  stateTitle: { fontFamily: kitFonts.heading, fontSize: 17, marginTop: 10 },
  stateText: { fontFamily: kitFonts.medium, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  guidanceCard: { alignItems: 'center', margin: 16, padding: 21, borderWidth: 1, borderRadius: 21 },
  guidanceIcon: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(33,139,37,0.1)' },
  guidanceTitle: { fontFamily: kitFonts.heading, fontSize: 19, marginTop: 13, textAlign: 'center' },
  guidanceText: { fontFamily: kitFonts.medium, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 7 },
  guidanceNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 11, borderRadius: 13, marginTop: 15 },
  guidanceNoteText: { flex: 1, fontFamily: kitFonts.medium, fontSize: 11, lineHeight: 16 },
  statusCard: { margin: 16, padding: 16, borderWidth: 1, borderRadius: 20 },
  statusHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(33,139,37,0.1)' },
  statusCopy: { flex: 1 },
  cardEyebrow: { fontFamily: kitFonts.bold, fontSize: 9, letterSpacing: 0.8 },
  centerName: { fontFamily: kitFonts.heading, fontSize: 15, marginTop: 4 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontFamily: kitFonts.bold, fontSize: 9 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 13 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 11 },
  infoCopy: { flex: 1 },
  infoValue: { fontFamily: kitFonts.medium, fontSize: 12, lineHeight: 18, marginTop: 3 },
  householdCard: { marginHorizontal: 16, marginBottom: 15, padding: 16, borderWidth: 1, borderRadius: 20 },
  sectionTitle: { fontFamily: kitFonts.heading, fontSize: 16, marginBottom: 7 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  personIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(33,139,37,0.1)' },
  personCopy: { flex: 1 },
  personName: { fontFamily: kitFonts.semibold, fontSize: 12 },
  personRelation: { fontFamily: kitFonts.medium, fontSize: 10, marginTop: 2 },
  directoryButton: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 11, marginHorizontal: 16, padding: 12, borderWidth: 1, borderRadius: 17 },
  directoryIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(33,139,37,0.1)' },
  directoryCopy: { flex: 1 },
  directoryTitle: { fontFamily: kitFonts.semibold, fontSize: 13 },
  directorySubtitle: { fontFamily: kitFonts.medium, fontSize: 10, marginTop: 4 },
  primaryButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14, borderRadius: 12, backgroundColor: GREEN, marginTop: 13 },
  primaryText: { color: Colors.white, fontFamily: kitFonts.bold, fontSize: 12 },
});
