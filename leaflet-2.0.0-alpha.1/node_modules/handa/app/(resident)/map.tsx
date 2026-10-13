import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import LeafletMap from '@components/LeafletMap';
import { AnimatedPressable } from '@components/Buttons';
import { authenticatedFetch } from '@services/apiClient';
import { useAuth } from '@hooks/useAuth';
import { MapEvacuationCenter, ResidentHouseholdMember } from '@types/index';

const GREEN = '#218B25';

type ResidentProfile = {
  id: string;
  name: string;
  email: string;
  firstName: string;
  middleName: string;
  lastName: string;
  birthday: string;
  sex: string;
  mobileNumber: string;
  currentAddress: string;
  householdMembers: ResidentHouseholdMember[];
};

type ResidentProfilePayload = Partial<ResidentProfile> & {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  mobile_number?: string | null;
  current_address?: string | null;
  household_members?: ResidentHouseholdMember[];
};

function firstText(...values: Array<string | null | undefined>): string {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim() ?? '';
}

function mergeResidentProfile(payload: ResidentProfilePayload, fallback?: Partial<ResidentProfile> | null): ResidentProfile {
  const name = firstText(payload.name, fallback?.name);
  const nameParts = name.split(/\s+/).filter(Boolean);
  const middleName = firstText(payload.middleName, payload.middle_name, fallback?.middleName);
  const responseMembers = Array.isArray(payload.householdMembers)
    ? payload.householdMembers
    : Array.isArray(payload.household_members) ? payload.household_members : undefined;
  const householdMembers = responseMembers?.length
    ? responseMembers
    : fallback?.householdMembers?.length ? fallback.householdMembers : responseMembers ?? fallback?.householdMembers ?? [];

  return {
    id: firstText(payload.id, fallback?.id),
    name,
    email: firstText(payload.email, fallback?.email),
    firstName: firstText(payload.firstName, payload.first_name, fallback?.firstName, nameParts[0]),
    middleName,
    lastName: firstText(payload.lastName, payload.last_name, fallback?.lastName, nameParts.slice(middleName ? 2 : 1).join(' ')),
    birthday: firstText(payload.birthday, fallback?.birthday),
    sex: firstText(payload.sex, fallback?.sex),
    mobileNumber: firstText(payload.mobileNumber, payload.mobile_number, fallback?.mobileNumber),
    currentAddress: firstText(payload.currentAddress, payload.current_address, fallback?.currentAddress),
    householdMembers,
  };
}

export default function ResidentMapScreen() {
  const { setAuthenticatedUser, user, isLoading: isAuthLoading } = useAuth();
  const [centers, setCenters] = useState<MapEvacuationCenter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<ResidentProfile | null>(() => user ? mergeResidentProfile(user, user) : null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [selectedCenter, setSelectedCenter] = useState<MapEvacuationCenter | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<ResidentHouseholdMember[]>([]);
  const [memberEditorOpen, setMemberEditorOpen] = useState(false);
  const [editingMemberIndex, setEditingMemberIndex] = useState<number | null>(null);
  const [memberName, setMemberName] = useState('');
  const [memberRelationship, setMemberRelationship] = useState('');
  const [profileError, setProfileError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    void authenticatedFetch('/api/v1/centers')
      .then(async (response) => {
        if (!response.ok) throw new Error('Center request failed');
        const result = await response.json() as MapEvacuationCenter[];
        if (mounted) setCenters(result);
      })
      .catch(() => {
        if (mounted) setError('Center locations are unavailable. Check your connection and try again.');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const selectCenter = useCallback(async (centerId: string) => {
    const center = centers.find((item) => item.id === centerId);
    if (!center) {
      setProfileError('This evacuation center is no longer available. Refresh the map and choose another center.');
      return;
    }
    if (isAuthLoading || !user) {
      setProfileError('Your account information could not be loaded. Return to the map and try again.');
      return;
    }
    setProfileError('');
    setIsProfileLoading(true);
    setMemberEditorOpen(false);
    const fallbackProfile = profile ?? mergeResidentProfile(user, user);
    try {
      const response = await authenticatedFetch('/api/v1/auth/me');
      if (!response.ok) throw new Error('Profile request failed');
      const result = await response.json() as ResidentProfilePayload;
      const freshProfile = mergeResidentProfile(result, fallbackProfile);
      setProfile(freshProfile);
      setHouseholdMembers(freshProfile.householdMembers.map((member) => ({ ...member })));
      setSelectedCenter(center);
    } catch {
      setProfile(fallbackProfile);
      setHouseholdMembers(fallbackProfile.householdMembers.map((member) => ({ ...member })));
      setSelectedCenter(center);
      setProfileError('Showing your saved account information. Check your connection before confirming.');
    } finally {
      setIsProfileLoading(false);
    }
  }, [centers, isAuthLoading, profile, user]);

  useEffect(() => {
    let mounted = true;
    if (isAuthLoading) return () => { mounted = false; };
    if (!user) {
      setProfile(null);
      setIsProfileLoading(false);
      return () => { mounted = false; };
    }

    const authenticatedProfile = mergeResidentProfile(user, user);
    setProfile(authenticatedProfile);
    setIsProfileLoading(true);
    void authenticatedFetch('/api/v1/auth/me')
      .then(async (response) => {
        if (!response.ok) throw new Error('Profile request failed');
        const result = await response.json() as ResidentProfilePayload;
        if (mounted) {
          const freshProfile = mergeResidentProfile(result, authenticatedProfile);
          setProfile(freshProfile);
          setHouseholdMembers(freshProfile.householdMembers.map((member) => ({ ...member })));
        }
      })
      .catch(() => {
        if (mounted) setProfileError('Your account information is unavailable. Sign in again and retry.');
      })
      .finally(() => {
        if (mounted) setIsProfileLoading(false);
      });
    return () => { mounted = false; };
    }, [isAuthLoading, user]);

  const openMemberEditor = (index: number | null = null) => {
    setEditingMemberIndex(index);
    setMemberName(index == null ? '' : householdMembers[index].name);
    setMemberRelationship(index == null ? '' : householdMembers[index].relationship);
    setMemberEditorOpen(true);
    setProfileError('');
  };

  const saveMember = () => {
    const member = { name: memberName.trim(), relationship: memberRelationship.trim() };
    if (!member.name || !member.relationship) {
      setProfileError('Enter a name and relationship for this household member.');
      return;
    }
    if (editingMemberIndex == null && householdMembers.length >= 20) {
      setProfileError('A household can include up to 21 people, including the registrant.');
      return;
    }
    setHouseholdMembers((current) => editingMemberIndex == null
      ? [...current, member]
      : current.map((item, index) => index === editingMemberIndex ? member : item));
    setMemberEditorOpen(false);
  };

  const confirmCenterRegistration = async () => {
    if (!profile || !selectedCenter) return;
    const age = calculateAge(profile.birthday);
    if (!profile.firstName.trim() || !profile.lastName.trim() || age == null || !['Male', 'Female'].includes(profile.sex) || !profile.mobileNumber || !profile.currentAddress.trim() || householdMembers.some((member) => !member.name.trim() || !member.relationship.trim())) {
      setProfileError('Complete your profile and household member details before confirming.');
      return;
    }

    setIsSubmitting(true);
    setProfileError('');
    try {
      const profileResponse = await authenticatedFetch('/api/v1/resident/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: profile.firstName.trim(),
          middleName: profile.middleName.trim() || null,
          lastName: profile.lastName.trim(),
          birthday: profile.birthday,
          sex: profile.sex,
          mobileNumber: profile.mobileNumber.replace(/[\s()-]/g, ''),
          currentAddress: profile.currentAddress.trim(),
          members: householdMembers.map((member) => ({ name: member.name.trim(), relationship: member.relationship.trim() })),
        }),
      });
      const savedProfile = await profileResponse.json() as ResidentProfile & { detail?: unknown };
      if (!profileResponse.ok) throw new Error(readRequestError(savedProfile.detail));
      setProfile(savedProfile);
      await setAuthenticatedUser({ ...savedProfile, role: 'resident' });

      const registrationResponse = await authenticatedFetch('/api/v1/resident/evacuation-registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          centerId: selectedCenter.id,
          firstName: savedProfile.firstName,
          middleName: savedProfile.middleName || null,
          lastName: savedProfile.lastName,
          age,
          sex: savedProfile.sex,
          contactNumber: savedProfile.mobileNumber.replace(/[\s()-]/g, ''),
          address: savedProfile.currentAddress,
          householdSize: householdMembers.length + 1,
          members: householdMembers,
        }),
      });
      const result = await registrationResponse.json() as { detail?: unknown };
      if (!registrationResponse.ok) throw new Error(readRequestError(result.detail));
      setSelectedCenter(null);
      Alert.alert('Registration submitted', `Your household is registered at ${selectedCenter.name}. A responder must confirm your check-in.`);
    } catch (caught) {
      setProfileError(caught instanceof Error ? caught.message : 'Registration could not be completed. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>MAP</Text>
          <Text style={styles.headerSubtitle}>Biñan City, Laguna</Text>
        </View>

        {isLoading && <View style={styles.status}><ActivityIndicator color={GREEN} /><Text style={styles.statusText}>Loading evacuation centers...</Text></View>}
        {!!error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.webMap}><LeafletMap centers={centers} onSelectCenter={selectCenter} /></View>
      </View>

      <Modal visible={!!selectedCenter && !memberEditorOpen} transparent animationType="fade" onRequestClose={() => setSelectedCenter(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedCenter(null)}>
          <Pressable style={styles.reviewDialog} onPress={(event) => event.stopPropagation()}>
            <View style={styles.dialogHeader}>
              <View style={styles.dialogHeadingCopy}><Text style={styles.dialogTitle}>Confirm evacuation center</Text><Text style={styles.dialogSubtitle}>Review your profile and household before registration.</Text></View>
              <Pressable onPress={() => setSelectedCenter(null)} accessibilityLabel="Close registration confirmation"><MaterialCommunityIcons name="close" size={23} color="#526652" /></Pressable>
            </View>
            <ScrollView style={styles.dialogScroll} contentContainerStyle={styles.dialogContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {selectedCenter && <View style={styles.centerSummary}>
                <View style={styles.centerSummaryIcon}><MaterialCommunityIcons name="map-marker-check-outline" size={22} color={GREEN} /></View>
                <View style={styles.centerSummaryCopy}>
                  <Text style={styles.centerName}>{selectedCenter.name}</Text>
                  <Text style={styles.centerLocation}>{selectedCenter.location}</Text>
                  <Text style={styles.centerCapacity}>{selectedCenter.current_occupancy} of {selectedCenter.capacity} people · {Math.max(0, selectedCenter.capacity - selectedCenter.current_occupancy)} spaces available</Text>
                </View>
              </View>}

              {isProfileLoading ? <View style={styles.profileLoading}><ActivityIndicator color={GREEN} /><Text style={styles.profileLoadingText}>Loading your account details...</Text></View> : profile ? <>
                <Text style={styles.sectionHeading}>YOUR INFORMATION</Text>
                <Text style={styles.accountLine}>{profile.email}</Text>
                <View style={styles.nameRow}>
                  <ProfileField label="First name" value={profile.firstName} onChangeText={(firstName) => setProfile((current) => current ? { ...current, firstName } : current)} />
                  <ProfileField label="Middle name" value={profile.middleName} onChangeText={(middleName) => setProfile((current) => current ? { ...current, middleName } : current)} />
                  <ProfileField label="Last name" value={profile.lastName} onChangeText={(lastName) => setProfile((current) => current ? { ...current, lastName } : current)} />
                </View>
                <View style={styles.nameRow}>
                  <ProfileField label="Birthday" value={profile.birthday} onChangeText={(birthday) => setProfile((current) => current ? { ...current, birthday } : current)} placeholder="YYYY-MM-DD" />
                  <ProfileField label="Contact number" value={profile.mobileNumber} onChangeText={(mobileNumber) => setProfile((current) => current ? { ...current, mobileNumber } : current)} placeholder="09XXXXXXXXX" />
                </View>
                <Text style={styles.fieldLabel}>Sex</Text>
                <View style={styles.sexChoiceRow}>
                  {(['Female', 'Male'] as const).map((sex) => <AnimatedPressable key={sex} style={[styles.sexChoice, profile.sex === sex && styles.sexChoiceSelected]} onPress={() => setProfile((current) => current ? { ...current, sex } : current)}><Text style={[styles.sexChoiceText, profile.sex === sex && styles.sexChoiceTextSelected]}>{sex}</Text></AnimatedPressable>)}
                </View>
                <ProfileField label="Current address" value={profile.currentAddress} onChangeText={(currentAddress) => setProfile((current) => current ? { ...current, currentAddress } : current)} />

                <View style={styles.membersHeading}>
                  <View><Text style={styles.sectionHeading}>HOUSEHOLD MEMBERS</Text><Text style={styles.householdCount}>{householdMembers.length + 1} people including you</Text></View>
                  <AnimatedPressable style={styles.addMemberButton} onPress={() => openMemberEditor()} disabled={householdMembers.length >= 20} accessibilityRole="button"><MaterialCommunityIcons name="plus" size={17} color={Colors.white} /><Text style={styles.addMemberText}>Add member</Text></AnimatedPressable>
                </View>
                {householdMembers.length === 0 ? <Text style={styles.emptyMembers}>No additional household members.</Text> : householdMembers.map((member, index) => (
                  <View key={`${index}-${member.name}`} style={styles.memberRow}>
                    <View style={styles.memberCopy}><Text style={styles.memberName}>{member.name}</Text><Text style={styles.memberRelationship}>{member.relationship}</Text></View>
                    <AnimatedPressable style={styles.memberAction} onPress={() => openMemberEditor(index)} accessibilityRole="button" accessibilityLabel={`Edit ${member.name}`}><MaterialCommunityIcons name="pencil-outline" size={19} color="#1769AA" /></AnimatedPressable>
                    <AnimatedPressable style={styles.memberAction} onPress={() => setHouseholdMembers((current) => current.filter((_item, itemIndex) => itemIndex !== index))} accessibilityRole="button" accessibilityLabel={`Delete ${member.name}`}><MaterialCommunityIcons name="trash-can-outline" size={19} color={Colors.emergency} /></AnimatedPressable>
                  </View>
                ))}
              </> : <Text style={styles.profileLoadingText}>Your profile could not be loaded. Close this window and try again.</Text>}
              {!!profileError && <Text style={styles.profileError}>{profileError}</Text>}
            </ScrollView>
            <View style={styles.dialogActions}>
              <AnimatedPressable style={styles.cancelButton} onPress={() => setSelectedCenter(null)} disabled={isSubmitting}><Text style={styles.cancelText}>Cancel</Text></AnimatedPressable>
              <AnimatedPressable style={[styles.confirmButton, (!profile || isProfileLoading || isSubmitting) && styles.confirmDisabled]} onPress={() => void confirmCenterRegistration()} disabled={!profile || isProfileLoading || isSubmitting} accessibilityRole="button">
                {isSubmitting ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.confirmText}>Confirm registration</Text>}
              </AnimatedPressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={memberEditorOpen} transparent animationType="fade" onRequestClose={() => setMemberEditorOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setMemberEditorOpen(false)}>
          <Pressable style={styles.memberDialog} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.dialogTitle}>{editingMemberIndex == null ? 'Add household member' : 'Edit household member'}</Text>
            <TextInput style={styles.memberInput} value={memberName} onChangeText={setMemberName} placeholder="Full name" placeholderTextColor="#79967A" />
            <TextInput style={styles.memberInput} value={memberRelationship} onChangeText={setMemberRelationship} placeholder="Relationship to you" placeholderTextColor="#79967A" />
            <View style={styles.memberDialogActions}>
              <AnimatedPressable style={styles.cancelButton} onPress={() => setMemberEditorOpen(false)}><Text style={styles.cancelText}>Cancel</Text></AnimatedPressable>
              <AnimatedPressable style={styles.confirmButton} onPress={saveMember}><Text style={styles.confirmText}>Save member</Text></AnimatedPressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, width: '100%', maxWidth: 900, alignSelf: 'center' },
  header: { backgroundColor: '#218B25', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12 },
  headerTitle: { color: Colors.white, fontSize: 28, fontWeight: '800' },
  headerSubtitle: { color: '#DFF1DF', fontSize: 12, marginTop: 2 },
  status: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  statusText: { color: Colors.textMuted, fontSize: 12 },
  error: { marginHorizontal: 14, marginTop: 6, color: Colors.emergency, fontSize: 12, textAlign: 'center' },
  webMap: { flex: 1, margin: 14, borderWidth: 1, borderColor: '#218B25', borderRadius: 8, overflow: 'hidden', backgroundColor: Colors.surfaceMuted },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  reviewDialog: { width: '100%', maxWidth: 680, maxHeight: '94%', padding: 16, borderRadius: 9, backgroundColor: Colors.surface },
  dialogHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#E5EDE5' },
  dialogHeadingCopy: { flex: 1 },
  dialogTitle: { color: Colors.text, fontSize: 19, fontWeight: '800' },
  dialogSubtitle: { color: Colors.textMuted, fontSize: 11, marginTop: 3 },
  dialogScroll: { flexShrink: 1 },
  dialogContent: { paddingBottom: 8 },
  centerSummary: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, padding: 10, borderRadius: 7, backgroundColor: Colors.surfaceMuted },
  centerSummaryIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: Colors.surface },
  centerSummaryCopy: { flex: 1 },
  centerName: { color: Colors.text, fontSize: 14, fontWeight: '800' },
  centerLocation: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  centerCapacity: { color: '#1769AA', fontSize: 10, fontWeight: '700', marginTop: 4 },
  sectionHeading: { color: GREEN, fontSize: 11, fontWeight: '900', marginTop: 14, marginBottom: 5 },
  accountLine: { color: Colors.textMuted, fontSize: 11, marginBottom: 6 },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  profileField: { flex: 1, minWidth: 145, marginBottom: 7 },
  fieldLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', marginBottom: 3 },
  profileInput: { minHeight: 42, paddingHorizontal: 9, borderWidth: 1, borderColor: Colors.border, borderRadius: 5, color: Colors.textMuted, fontSize: 12 },
  sexChoiceRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  sexChoice: { minWidth: 90, minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: '#A8C8A8', borderRadius: 5 },
  sexChoiceSelected: { borderColor: GREEN, backgroundColor: GREEN },
  sexChoiceText: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },
  sexChoiceTextSelected: { color: Colors.white },
  membersHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 3 },
  householdCount: { color: Colors.textMuted, fontSize: 10, marginTop: -3 },
  addMemberButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 9, borderRadius: 5, backgroundColor: GREEN },
  addMemberText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
  emptyMembers: { color: Colors.textMuted, fontSize: 11, paddingVertical: 8 },
  memberRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingLeft: 9, borderWidth: 1, borderColor: Colors.border, borderRadius: 6, backgroundColor: Colors.background },
  memberCopy: { flex: 1, minWidth: 0 },
  memberName: { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
  memberRelationship: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  memberAction: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  profileError: { color: Colors.emergency, fontSize: 11, marginTop: 8 },
  profileLoading: { minHeight: 120, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  profileLoadingText: { color: Colors.textMuted, fontSize: 11, marginTop: 8 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E5EDE5' },
  cancelButton: { minHeight: 44, minWidth: 90, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border, borderRadius: 5 },
  cancelText: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },
  confirmButton: { minHeight: 44, minWidth: 155, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 5, backgroundColor: GREEN },
  confirmText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  confirmDisabled: { opacity: 0.55 },
  memberDialog: { width: '100%', maxWidth: 400, padding: 18, borderRadius: 8, backgroundColor: Colors.surface },
  memberInput: { minHeight: 44, marginTop: 12, paddingHorizontal: 10, borderWidth: 1, borderColor: Colors.border, borderRadius: 5, color: Colors.textMuted, fontSize: 14 },
  memberDialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
});

function ProfileField({ label, value, onChangeText, placeholder }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string }) {
  return <View style={styles.profileField}><Text style={styles.fieldLabel}>{label}</Text><TextInput style={styles.profileInput} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#79967A" /></View>;
}

function calculateAge(birthday: string): number | null {
  const date = new Date(`${birthday}T00:00:00`);
  if (!birthday || Number.isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  if (today.getMonth() < date.getMonth() || (today.getMonth() === date.getMonth() && today.getDate() < date.getDate())) age -= 1;
  return age >= 0 && age <= 150 ? age : null;
}

function readRequestError(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((item) => item && typeof item === 'object' && 'msg' in item ? String(item.msg) : '').filter(Boolean).join(' ') || 'Check the entered details and try again.';
  return 'Check the entered details and try again.';
}
