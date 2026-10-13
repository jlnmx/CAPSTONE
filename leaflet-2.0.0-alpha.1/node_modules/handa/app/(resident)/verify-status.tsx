import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable as TouchableOpacity } from '@components/Buttons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@constants/colors';
import { authenticatedFetch } from '@services/apiClient';

const GREEN = '#218B25';

type HouseholdMember = {
  id: string;
  name: string;
  relationship: string;
  status: string;
};

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
  members: HouseholdMember[];
};

export default function VerifyStatusScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<EvacuationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/v1/resident/evacuation-status');
      if (!response.ok) throw new Error('Status could not be loaded from the server.');
      setStatus(await response.json() as EvacuationStatus);
      setError('');
    } catch {
      setError('Live evacuation status is unavailable. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    const refresh = setInterval(() => void loadStatus(), 15000);
    return () => clearInterval(refresh);
  }, [loadStatus]);

  const isRegistered = !!status?.registrationId;
  const statusLabel = status?.status === 'checked_in' ? 'CHECKED IN' : status?.status === 'evacuated' ? 'EVACUATED' : status?.status === 'released' ? 'RELEASED' : 'AWAITING CHECK-IN';
  const statusDescription = status?.status === 'checked_in'
    ? `Verified by ${status.checkedInBy || 'an evacuation responder'}`
    : status?.status === 'evacuated'
      ? 'Your household evacuation was verified by a responder.'
      : status?.status === 'released'
        ? 'Your household has been released from the center.'
        : 'A responder must confirm your household’s arrival at the center.';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>VERIFY STATUS</Text>
          <TouchableOpacity onPress={() => { setIsLoading(true); void loadStatus(); }} accessibilityRole="button" accessibilityLabel="Refresh evacuation status" style={styles.refreshButton}>
            <MaterialCommunityIcons name="refresh" size={22} color={Colors.white} />
          </TouchableOpacity>
        </View>

        {isLoading && !status ? (
          <View style={styles.centerState}><ActivityIndicator color={GREEN} /><Text style={styles.stateText}>Loading live evacuation status...</Text></View>
        ) : error && !status ? (
          <View style={styles.centerState}>
            <MaterialCommunityIcons name="alert-circle-outline" size={32} color="#A34545" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => { setIsLoading(true); void loadStatus(); }}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
          </View>
        ) : !isRegistered ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={34} color={GREEN} />
            <Text style={styles.emptyTitle}>No evacuation registration</Text>
            <Text style={styles.emptyText}>Register your household at an available barangay center to see its status here.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/(resident)/register-evacuee')}><Text style={styles.primaryText}>Register household</Text></TouchableOpacity>
          </View>
        ) : status ? (
          <>
            <View style={styles.personCard}>
              <View style={styles.avatar}><MaterialCommunityIcons name="account" size={26} color={GREEN} /></View>
              <View style={styles.personCopy}>
                <Text style={styles.personName}>{status.evacuee?.name || status.resident.name}</Text>
                <Text style={styles.personDetails}>{status.registrationId} · {status.evacuee?.address || 'Address not provided'}</Text>
              </View>
            </View>

            <View style={styles.statusCard}>
              <View style={styles.cardHeading}>
                <View style={styles.headingTitle}><MaterialCommunityIcons name="check-decagram-outline" size={18} color={GREEN} /><Text style={styles.sectionTitle}>VERIFIED STATUS</Text></View>
                <Text style={styles.liveTag}>LIVE DATABASE</Text>
              </View>
              <View style={styles.statusContent}>
                <View style={[styles.statusIcon, status.status === 'checked_in' ? styles.statusConfirmed : styles.statusPending]}>
                  <MaterialCommunityIcons name={status.status === 'checked_in' || status.status === 'evacuated' ? 'check' : 'clock-outline'} size={28} color={Colors.white} />
                </View>
                <View style={styles.statusCopy}>
                  <Text style={styles.statusLabel}>{statusLabel}</Text>
                  <Text style={styles.statusDescription}>{statusDescription}</Text>
                  {status.checkedInAt && <Text style={styles.timestamp}>{new Date(status.checkedInAt).toLocaleString()}</Text>}
                </View>
              </View>
            </View>

            <View style={styles.assignmentCard}>
              <View style={styles.cardHeading}>
                <Text style={styles.sectionTitle}>EVACUATION ASSIGNMENT</Text>
                <Text style={styles.memberCount}>{status.householdCount} {status.householdCount === 1 ? 'MEMBER' : 'MEMBERS'}</Text>
              </View>
              <Detail icon="map-marker-outline" label="CENTER ASSIGNED" value={status.center?.name || 'Not available'} />
              <Detail icon="map-outline" label="LOCATION" value={status.center?.location || 'Not available'} />
              <Detail icon="account-check-outline" label="CHECK-IN VERIFIED BY" value={status.checkedInBy || 'Awaiting responder'} />
            </View>

            <View style={styles.householdCard}>
              <View style={styles.cardHeading}>
                <Text style={styles.sectionTitle}>HOUSEHOLD MEMBERS</Text>
                <Text style={styles.memberCount}>{status.members.length + 1} TOTAL</Text>
              </View>
              <HouseholdRow name={status.evacuee?.name || status.resident.name} relationship="Evacuee" status={status.status} primary />
              {status.members.map((member) => <HouseholdRow key={member.id} name={member.name} relationship={member.relationship} status={member.status} />)}
              {status.members.length === 0 && <Text style={styles.noMembers}>No additional household members were registered.</Text>}
            </View>
          </>
        ) : null}
        {!!error && status && <Text style={styles.staleError}>{error}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

function Detail({ icon, label, value }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <MaterialCommunityIcons name={icon} size={16} color={GREEN} />
      <View style={styles.detailCopy}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>
    </View>
  );
}

function HouseholdRow({ name, relationship, status, primary = false }: { name: string; relationship: string; status: string; primary?: boolean }) {
  const label = status.replace('_', ' ').toUpperCase();
  return (
    <View style={styles.memberRow}>
      <View style={styles.memberAvatar}><MaterialCommunityIcons name={primary ? 'account' : 'account-outline'} size={21} color={GREEN} /></View>
      <View style={styles.memberCopy}><Text style={styles.memberName}>{name}</Text><Text style={styles.memberRelationship}>{relationship}</Text></View>
      <Text style={[styles.memberStatus, status === 'checked_in' && styles.memberStatusConfirmed]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surfaceMuted },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: 20 },
  header: { minHeight: 70, paddingHorizontal: 16, backgroundColor: GREEN, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: Colors.white, fontSize: 24, fontWeight: '800' },
  refreshButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  centerState: { flex: 1, minHeight: 240, alignItems: 'center', justifyContent: 'center', padding: 26, gap: 12 },
  stateText: { color: Colors.textMuted, fontSize: 13 },
  errorText: { color: '#A34545', fontSize: 13, textAlign: 'center' },
  retryButton: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 5, backgroundColor: GREEN },
  retryText: { color: Colors.white, fontWeight: '700' },
  emptyState: { margin: 16, minHeight: 250, alignItems: 'center', justifyContent: 'center', padding: 24, borderWidth: 1, borderColor: '#B5D4B5', borderRadius: 7, backgroundColor: Colors.surface },
  emptyTitle: { marginTop: 12, color: '#1E5322', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyText: { marginTop: 7, color: Colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  primaryButton: { marginTop: 18, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 5, backgroundColor: GREEN },
  primaryText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  personCard: { minHeight: 72, marginHorizontal: 11, marginTop: 13, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', borderWidth: 1, borderColor: '#92C092', borderRadius: 6, backgroundColor: Colors.surface },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceMuted },
  personCopy: { flex: 1, marginLeft: 10 },
  personName: { color: Colors.text, fontSize: 13, fontWeight: '800' },
  personDetails: { marginTop: 4, color: Colors.textMuted, fontSize: 9 },
  statusCard: { marginHorizontal: 11, marginTop: 10, padding: 11, borderWidth: 1, borderColor: '#78B578', borderRadius: 6, backgroundColor: Colors.surface },
  cardHeading: { minHeight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  headingTitle: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sectionTitle: { color: Colors.text, fontSize: 11, fontWeight: '800' },
  liveTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: Colors.surfaceMuted, color: GREEN, fontSize: 8, fontWeight: '700' },
  statusContent: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  statusIcon: { width: 38, height: 38, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  statusConfirmed: { backgroundColor: '#83B982' },
  statusPending: { backgroundColor: '#D99932' },
  statusCopy: { flex: 1 },
  statusLabel: { color: Colors.text, fontSize: 13, fontWeight: '900' },
  statusDescription: { marginTop: 3, color: Colors.textMuted, fontSize: 10 },
  timestamp: { marginTop: 3, color: Colors.textMuted, fontSize: 9 },
  assignmentCard: { marginHorizontal: 11, marginTop: 10, padding: 11, borderWidth: 1, borderColor: '#78B578', borderRadius: 6, backgroundColor: Colors.surface },
  memberCount: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: Colors.surfaceMuted, color: GREEN, fontSize: 8, fontWeight: '700' },
  detailRow: { minHeight: 39, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#EDF2ED' },
  detailCopy: { flex: 1 },
  detailLabel: { color: Colors.textMuted, fontSize: 8, fontWeight: '800' },
  detailValue: { marginTop: 2, color: Colors.textMuted, fontSize: 11, fontWeight: '600' },
  householdCard: { marginHorizontal: 11, marginTop: 10, padding: 10, borderWidth: 1, borderColor: '#78B578', borderRadius: 6, backgroundColor: Colors.surface },
  memberRow: { minHeight: 49, marginTop: 6, paddingHorizontal: 8, alignItems: 'center', flexDirection: 'row', gap: 8, borderWidth: 1, borderColor: '#B6D4B6', borderRadius: 12, backgroundColor: Colors.surfaceMuted },
  memberAvatar: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#88B788', borderRadius: 17, backgroundColor: Colors.surface },
  memberCopy: { flex: 1 },
  memberName: { color: Colors.text, fontSize: 11, fontWeight: '800' },
  memberRelationship: { marginTop: 2, color: Colors.textMuted, fontSize: 9 },
  memberStatus: { maxWidth: 92, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: Colors.surfaceMuted, color: Colors.textMuted, fontSize: 7, fontWeight: '800', textAlign: 'center' },
  memberStatusConfirmed: { backgroundColor: '#78AE78', color: Colors.white },
  noMembers: { paddingVertical: 12, color: Colors.textMuted, fontSize: 10 },
  staleError: { margin: 12, color: '#A34545', fontSize: 10 },
});
