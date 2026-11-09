import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable as TouchableOpacity } from '@components/Buttons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@constants/colors';
import { authenticatedFetch } from '@services/apiClient';
import { GradientHeader, Reveal } from '@components/ScreenKit';
import { PulseDot } from '@components/IncidentCardKit';

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

type EvacuationCenter = {
  id: string;
  name: string;
  location: string;
  capacity: number;
  current_occupancy: number;
  status: string;
};

export default function VerifyStatusScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<EvacuationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [centers, setCenters] = useState<EvacuationCenter[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState('');
  const [isCenterEditorOpen, setIsCenterEditorOpen] = useState(false);
  const [isLoadingCenters, setIsLoadingCenters] = useState(false);
  const [isSavingCenter, setIsSavingCenter] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

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
  const statusLabel = status?.status === 'checked_in' ? 'CHECKED IN' : status?.status === 'evacuated' ? 'EVACUATED' : 'AWAITING CHECK-IN';
  const statusDescription = status?.status === 'checked_in'
    ? `Verified by ${status.checkedInBy || 'an evacuation responder'}`
    : status?.status === 'evacuated'
      ? 'Your household evacuation was verified by a responder.'
      : 'A responder must confirm your household’s arrival at the center.';

  const openCenterEditor = async () => {
    setIsCenterEditorOpen(true);
    setIsLoadingCenters(true);
    setActionError('');
    setSelectedCenterId(status?.center?.id || '');
    try {
      const response = await authenticatedFetch('/api/v1/centers');
      if (!response.ok) throw new Error('Evacuation centers could not be loaded.');
      const result = await response.json() as EvacuationCenter[];
      setCenters(result.filter((center) => center.id === status?.center?.id || (center.status !== 'closed' && center.status !== 'full' && center.current_occupancy < center.capacity)));
    } catch (loadError) {
      setActionError(loadError instanceof Error ? loadError.message : 'Evacuation centers could not be loaded.');
    } finally {
      setIsLoadingCenters(false);
    }
  };

  const saveCenter = async () => {
    if (!status?.registrationId || !selectedCenterId || selectedCenterId === status.center?.id) return;
    setIsSavingCenter(true);
    setActionError('');
    try {
      const response = await authenticatedFetch(`/api/v1/resident/evacuation-registrations/${encodeURIComponent(status.registrationId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ centerId: selectedCenterId }),
      });
      const result = await response.json() as { detail?: unknown };
      if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'The evacuation center could not be changed.');
      setIsCenterEditorOpen(false);
      setActionMessage('Your pending registration has been moved to the selected center.');
      await loadStatus();
    } catch (saveError) {
      setActionError(saveError instanceof Error ? saveError.message : 'The evacuation center could not be changed.');
    } finally {
      setIsSavingCenter(false);
    }
  };

  const cancelRegistration = async () => {
    if (!status?.registrationId) return;
    setIsCancelling(true);
    setActionError('');
    try {
      const response = await authenticatedFetch(`/api/v1/resident/evacuation-registrations/${encodeURIComponent(status.registrationId)}`, { method: 'DELETE' });
      const result = await response.json() as { detail?: unknown };
      if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'The pending registration could not be canceled.');
      setIsCancelDialogOpen(false);
      setActionMessage('Your pending registration was canceled. You can register again when you are ready.');
      await loadStatus();
    } catch (cancelError) {
      setActionError(cancelError instanceof Error ? cancelError.message : 'The pending registration could not be canceled.');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GradientHeader title="Verify Status" subtitle="Live evacuation check-in" icon="shield-check" right={
          <TouchableOpacity onPress={() => { setIsLoading(true); void loadStatus(); }} accessibilityRole="button" accessibilityLabel="Refresh evacuation status" style={styles.refreshButton}>
            <MaterialCommunityIcons name="refresh" size={22} color={Colors.white} />
          </TouchableOpacity>
        } />

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
            {!!actionMessage && <Text style={styles.actionMessage}>{actionMessage}</Text>}
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/(resident)/register-evacuee')}><Text style={styles.primaryText}>Register household</Text></TouchableOpacity>
          </View>
        ) : status ? (
          <>
            <Reveal index={0}><View style={styles.personCard}>
              <View style={styles.avatar}><MaterialCommunityIcons name="account" size={26} color={GREEN} /></View>
              <View style={styles.personCopy}>
                <Text style={styles.personName}>{status.evacuee?.name || status.resident.name}</Text>
                <Text style={styles.personDetails}>{status.registrationId} · {status.evacuee?.address || 'Address not provided'}</Text>
              </View>
            </View></Reveal>

            <Reveal index={1}><View style={[styles.statusCard, status.status === 'checked_in' || status.status === 'evacuated' ? styles.statusCardOk : styles.statusCardPending]}>
              <View style={styles.cardHeading}>
                <View style={styles.headingTitle}><MaterialCommunityIcons name="check-decagram-outline" size={18} color={GREEN} /><Text style={styles.sectionTitle}>Verified status</Text></View>
                <View style={styles.livePill}><PulseDot color={GREEN} /><Text style={styles.liveTag}>LIVE</Text></View>
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
            </View></Reveal>

            <Reveal index={2}><View style={styles.assignmentCard}>
              <View style={styles.cardHeading}>
                <Text style={styles.sectionTitle}>Evacuation assignment</Text>
                <Text style={styles.memberCount}>{status.householdCount} {status.householdCount === 1 ? 'MEMBER' : 'MEMBERS'}</Text>
              </View>
              <Detail icon="map-marker-outline" label="CENTER ASSIGNED" value={status.center?.name || 'Not available'} />
              <Detail icon="map-outline" label="LOCATION" value={status.center?.location || 'Not available'} />
              <Detail icon="account-check-outline" label="CHECK-IN VERIFIED BY" value={status.checkedInBy || 'Awaiting responder'} />
            </View></Reveal>

            {status.status === 'registered' && <Reveal index={3}><View style={styles.registrationActions}>
              <TouchableOpacity style={styles.changeCenterButton} onPress={() => void openCenterEditor()} accessibilityRole="button">
                <MaterialCommunityIcons name="map-marker-edit-outline" size={18} color={GREEN} />
                <Text style={styles.changeCenterText}>Change center</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelRegistrationButton} onPress={() => { setActionError(''); setIsCancelDialogOpen(true); }} accessibilityRole="button">
                <MaterialCommunityIcons name="close-circle-outline" size={18} color="#A34545" />
                <Text style={styles.cancelRegistrationText}>Cancel registration</Text>
              </TouchableOpacity>
            </View></Reveal>}
            {!!actionMessage && isRegistered && <Text style={styles.actionMessage}>{actionMessage}</Text>}
            {!!actionError && !isCenterEditorOpen && <Text style={styles.staleError}>{actionError}</Text>}

            <Reveal index={4}><View style={styles.householdCard}>
              <View style={styles.cardHeading}>
                <Text style={styles.sectionTitle}>Household members</Text>
                <Text style={styles.memberCount}>{status.members.length + 1} TOTAL</Text>
              </View>
              <HouseholdRow name={status.evacuee?.name || status.resident.name} relationship="Evacuee" status={status.status} primary />
              {status.members.map((member) => <HouseholdRow key={member.id} name={member.name} relationship={member.relationship} status={member.status} />)}
              {status.members.length === 0 && <Text style={styles.noMembers}>No additional household members were registered.</Text>}
            </View></Reveal>
          </>
        ) : null}
        {!!error && status && <Text style={styles.staleError}>{error}</Text>}
      </ScrollView>
      <Modal transparent visible={isCenterEditorOpen} animationType="fade" onRequestClose={() => setIsCenterEditorOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setIsCenterEditorOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>Change evacuation center</Text>
            <Text style={styles.modalDescription}>Choose a center that is accepting registrations. Your household is still awaiting check-in.</Text>
            {isLoadingCenters ? <ActivityIndicator style={styles.modalLoading} color={GREEN} /> : <ScrollView style={styles.centerOptions} showsVerticalScrollIndicator={false}>
              {centers.map((center) => <Pressable key={center.id} style={[styles.centerOption, selectedCenterId === center.id && styles.centerOptionSelected]} onPress={() => setSelectedCenterId(center.id)} accessibilityRole="radio" accessibilityState={{ selected: selectedCenterId === center.id }}>
                <View style={styles.centerOptionCopy}><Text style={styles.centerOptionName}>{center.name}</Text><Text style={styles.centerOptionLocation}>{center.location} · {Math.max(0, center.capacity - center.current_occupancy)} spaces</Text></View>
                {selectedCenterId === center.id && <MaterialCommunityIcons name="check-circle" size={19} color={GREEN} />}
              </Pressable>)}
              {centers.length === 0 && <Text style={styles.modalDescription}>No other centers are currently accepting registrations.</Text>}
            </ScrollView>}
            {!!actionError && <Text style={styles.errorText}>{actionError}</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setIsCenterEditorOpen(false)} disabled={isSavingCenter}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalSaveButton, (!selectedCenterId || selectedCenterId === status?.center?.id || isSavingCenter) && styles.buttonDisabled]} onPress={() => void saveCenter()} disabled={!selectedCenterId || selectedCenterId === status?.center?.id || isSavingCenter} accessibilityRole="button">
                {isSavingCenter ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.modalSaveText}>Save center</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal transparent visible={isCancelDialogOpen} animationType="fade" onRequestClose={() => setIsCancelDialogOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setIsCancelDialogOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>Cancel pending registration?</Text>
            <Text style={styles.modalDescription}>This removes your household’s pending center registration. You can register again later or choose a different center.</Text>
            {!!actionError && <Text style={styles.errorText}>{actionError}</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setIsCancelDialogOpen(false)} disabled={isCancelling}><Text style={styles.modalCancelText}>Keep registration</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalDeleteButton, isCancelling && styles.buttonDisabled]} onPress={() => void cancelRegistration()} disabled={isCancelling} accessibilityRole="button">
                {isCancelling ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.modalSaveText}>Cancel registration</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  refreshButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
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
  personCard: { minHeight: 80, marginHorizontal: 14, marginTop: 16, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', borderWidth: 1, borderColor: '#E0EAE0', borderRadius: 20, backgroundColor: Colors.surface, shadowColor: '#103A18', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 2 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E4F1E4' },
  personCopy: { flex: 1, marginLeft: 12 },
  personName: { color: Colors.text, fontFamily: 'Sora_700Bold', fontSize: 15 },
  personDetails: { marginTop: 4, color: Colors.textMuted, fontSize: 11 },
  statusCard: { marginHorizontal: 14, marginTop: 12, padding: 16, borderWidth: 1, borderColor: '#E0EAE0', borderLeftWidth: 6, borderRadius: 20, backgroundColor: Colors.surface, shadowColor: '#103A18', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 2 },
  statusCardOk: { borderLeftColor: GREEN },
  statusCardPending: { borderLeftColor: '#E0A02E' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, backgroundColor: '#E4F1E4' },
  cardHeading: { minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  headingTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { color: Colors.text, fontFamily: 'Sora_700Bold', fontSize: 14 },
  liveTag: { color: GREEN, fontSize: 10, fontWeight: '800' },
  statusContent: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  statusIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  statusConfirmed: { backgroundColor: GREEN },
  statusPending: { backgroundColor: '#E0A02E' },
  statusCopy: { flex: 1 },
  statusLabel: { color: Colors.text, fontFamily: 'Sora_700Bold', fontSize: 16 },
  statusDescription: { marginTop: 4, color: Colors.textMuted, fontSize: 12, lineHeight: 17 },
  timestamp: { marginTop: 4, color: Colors.textMuted, fontSize: 10 },
  assignmentCard: { marginHorizontal: 14, marginTop: 12, padding: 16, borderWidth: 1, borderColor: '#E0EAE0', borderRadius: 20, backgroundColor: Colors.surface, shadowColor: '#103A18', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 2 },
  memberCount: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, backgroundColor: '#E4F1E4', color: GREEN, fontSize: 10, fontWeight: '700', overflow: 'hidden' },
  detailRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#EDF2ED' },
  detailCopy: { flex: 1 },
  detailLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  detailValue: { marginTop: 2, color: Colors.text, fontSize: 13, fontWeight: '600' },
  householdCard: { marginHorizontal: 14, marginTop: 12, padding: 16, borderWidth: 1, borderColor: '#E0EAE0', borderRadius: 20, backgroundColor: Colors.surface, shadowColor: '#103A18', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 2 },
  memberRow: { minHeight: 56, marginTop: 8, paddingHorizontal: 10, alignItems: 'center', flexDirection: 'row', gap: 10, borderRadius: 14, backgroundColor: '#F4F9F4' },
  memberAvatar: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: Colors.surface },
  memberCopy: { flex: 1 },
  memberName: { color: Colors.text, fontSize: 13, fontWeight: '800' },
  memberRelationship: { marginTop: 2, color: Colors.textMuted, fontSize: 11 },
  memberStatus: { maxWidth: 100, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: '#E4EBE4', color: Colors.textMuted, fontSize: 8, fontWeight: '800', textAlign: 'center' },
  memberStatusConfirmed: { backgroundColor: '#78AE78', color: Colors.white },
  noMembers: { paddingVertical: 12, color: Colors.textMuted, fontSize: 10 },
  staleError: { margin: 12, color: '#A34545', fontSize: 10 },
  registrationActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginHorizontal: 14, marginTop: 12 },
  changeCenterButton: { minHeight: 48, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10, borderWidth: 1.5, borderColor: GREEN, borderRadius: 16, backgroundColor: Colors.surface },
  changeCenterText: { color: GREEN, fontSize: 13, fontWeight: '700' },
  cancelRegistrationButton: { minHeight: 48, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10, borderWidth: 1.5, borderColor: '#D5A5A5', borderRadius: 16, backgroundColor: Colors.surface },
  cancelRegistrationText: { color: '#A34545', fontSize: 13, fontWeight: '700' },
  actionMessage: { marginHorizontal: 14, marginTop: 10, color: GREEN, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: { width: '100%', maxWidth: 440, maxHeight: '90%', padding: 18, borderRadius: 8, backgroundColor: Colors.surface },
  modalTitle: { color: Colors.text, fontSize: 17, fontWeight: '800' },
  modalDescription: { marginTop: 6, color: Colors.textMuted, fontSize: 12, lineHeight: 18 },
  modalLoading: { marginVertical: 24 },
  centerOptions: { flexShrink: 1, marginTop: 10 },
  centerOption: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#E8EFE8' },
  centerOptionSelected: { backgroundColor: '#F1F7F1' },
  centerOptionCopy: { flex: 1 },
  centerOptionName: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  centerOptionLocation: { marginTop: 3, color: Colors.textMuted, fontSize: 10 },
  errorText: { marginTop: 10, color: '#A34545', fontSize: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  modalCancelButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 12 },
  modalCancelText: { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
  modalSaveButton: { minWidth: 118, minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 5, backgroundColor: GREEN },
  modalDeleteButton: { minWidth: 142, minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 5, backgroundColor: '#A34545' },
  modalSaveText: { color: Colors.white, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  buttonDisabled: { opacity: 0.55 },
});
