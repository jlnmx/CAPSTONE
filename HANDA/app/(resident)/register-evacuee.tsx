import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import { AnimatedPressable } from '@components/Buttons';
import { authenticatedFetch } from '@services/apiClient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@hooks/useAuth';
import { useResponsiveLayout } from '@hooks/useResponsiveLayout';
import { GradientHeader, SectionCard, Field, SexToggle } from '@components/ScreenKit';
import { HouseholdMemberFields, EMPTY_MEMBER_DRAFT, HouseholdMemberDraft as MemberFormDraft, draftToMember, memberToDraft, memberSummary, validateMemberDraft, isMemberComplete } from '@components/HouseholdMemberFields';
import type { ResidentHouseholdMember } from '@types/index';
import { saveLocalEvacuationRegistration } from '@services/localDatabase';
import { syncPendingLocalData } from '@services/syncService';
import { fetchJsonWithCache } from '@services/offlineCache';

const GREEN = '#218B25';
const FIELD_GREEN = '#548B56';
const SEXES = ['Female', 'Male'];

type EvacuationCenter = {
  id: string;
  name: string;
  location: string;
  capacity: number;
  current_occupancy: number;
  status: 'available' | 'limited' | 'full' | 'closed';
};

type CenterFilter = 'all' | 'available' | 'limited';
type CenterSort = 'name' | 'spaces' | 'occupancy';

type HouseholdMemberDraft = ResidentHouseholdMember;
type ResidentProfileResponse = {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  birthday?: string;
  sex?: string;
  mobileNumber?: string;
  mobile_number?: string;
  currentAddress?: string;
  current_address?: string;
  householdMembers?: HouseholdMemberDraft[];
};

function normalizeSex(value?: string): string {
  return SEXES.find((item) => item.toLowerCase() === value?.trim().toLowerCase()) ?? '';
}

function calculateAge(birthday?: string): number | null {
  if (!birthday) return null;
  const date = new Date(`${birthday.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  if (today.getMonth() < date.getMonth() || (today.getMonth() === date.getMonth() && today.getDate() < date.getDate())) age -= 1;
  return age >= 0 && age <= 150 ? age : null;
}

function availableSpaces(center: EvacuationCenter) {
  return Math.max(0, Number(center.capacity) - Number(center.current_occupancy));
}

function occupancyRatio(center: EvacuationCenter) {
  const capacity = Number(center.capacity);
  return capacity > 0 ? Number(center.current_occupancy) / capacity : 1;
}

export default function RegisterEvacueeScreen() {
  const { centerId: routeCenterId } = useLocalSearchParams<{ centerId?: string }>();
  const requestedCenterId = Array.isArray(routeCenterId) ? routeCenterId[0] : routeCenterId;
  const { isCompact, isMobile } = useResponsiveLayout();
  const { user, setAuthenticatedUser } = useAuth();
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState(() => String(calculateAge(user?.birthday) ?? ''));
  const [sex, setSex] = useState(() => normalizeSex(user?.sex));
  const [contactNumber, setContactNumber] = useState(() => user?.mobileNumber ?? '');
  const [address, setAddress] = useState('');
  const [centerId, setCenterId] = useState(requestedCenterId ?? '');
  const [centers, setCenters] = useState<EvacuationCenter[]>([]);
  const [centerSearch, setCenterSearch] = useState('');
  const [centerFilter, setCenterFilter] = useState<CenterFilter>('all');
  const [centerSort, setCenterSort] = useState<CenterSort>('name');
  const [isCentersLoading, setIsCentersLoading] = useState(true);
  const [centerError, setCenterError] = useState('');
  const [members, setMembers] = useState<HouseholdMemberDraft[]>(() => user?.householdMembers?.map((member) => ({ ...member })) ?? []);
  const [isHouseholdLoading, setIsHouseholdLoading] = useState(true);
  const [memberEditorOpen, setMemberEditorOpen] = useState(false);
  const [editingMemberIndex, setEditingMemberIndex] = useState<number | null>(null);
  const [memberDraft, setMemberDraft] = useState<MemberFormDraft>(EMPTY_MEMBER_DRAFT);
  const [memberError, setMemberError] = useState('');
  const [returnToReview, setReturnToReview] = useState(false);
  const [formError, setFormError] = useState('');
  const [reviewVisible, setReviewVisible] = useState(false);
  const [registrationSuccessVisible, setRegistrationSuccessVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingRegistration, setExistingRegistration] = useState<{ centerName: string } | null>(null);
  const [isCheckingExistingRegistration, setIsCheckingExistingRegistration] = useState(true);

  useEffect(() => {
    if (requestedCenterId) setCenterId(requestedCenterId);
  }, [requestedCenterId]);

  useEffect(() => {
    let isCurrent = true;
    void authenticatedFetch('/api/v1/resident/evacuation-status')
      .then(async (response) => {
        if (!response.ok) return;
        const status = await response.json() as { registrationId?: string | null; center?: { name?: string } | null };
        if (isCurrent && status.registrationId) setExistingRegistration({ centerName: status.center?.name || 'your selected center' });
      })
      .catch(() => undefined)
      .finally(() => { if (isCurrent) setIsCheckingExistingRegistration(false); });
    return () => { isCurrent = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.firstName || user.lastName) {
      setFirstName((current) => current || user.firstName || '');
      setMiddleName((current) => current || user.middleName || '');
      setLastName((current) => current || user.lastName || '');
      return;
    }
    const nameParts = user.name.trim().split(/\s+/).filter(Boolean);
    if (!nameParts.length) return;
    setFirstName((current) => current || (nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0]));
    setLastName((current) => current || (nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''));
  }, [user]);

  useEffect(() => {
    let isCurrent = true;
    const loadHouseholdMembers = async () => {
      try {
        const response = await authenticatedFetch('/api/v1/auth/me');
        if (!response.ok) throw new Error('Household members could not be loaded.');
        const profile = await response.json() as ResidentProfileResponse;
        if (isCurrent) {
          setMembers(profile.householdMembers?.map((member) => ({ ...member })) ?? []);
          setFirstName((current) => current || profile.firstName || '');
          setMiddleName((current) => current || profile.middleName || '');
          setLastName((current) => current || profile.lastName || '');
          setAge((current) => current || String(calculateAge(profile.birthday) ?? ''));
          setSex((current) => current || normalizeSex(profile.sex) || normalizeSex(user?.sex));
          setContactNumber((current) => current || profile.mobileNumber || profile.mobile_number || user?.mobileNumber || '');
          setAddress((current) => current || profile.currentAddress || profile.current_address || user?.currentAddress || '');
        }
      } catch {
        if (isCurrent) {
          setMembers(user?.householdMembers?.map((member) => ({ ...member })) ?? []);
          setAge((current) => current || String(calculateAge(user?.birthday) ?? ''));
          setSex((current) => current || normalizeSex(user?.sex));
          setContactNumber((current) => current || user?.mobileNumber || '');
          setAddress((current) => current || user?.currentAddress || '');
        }
      } finally {
        if (isCurrent) setIsHouseholdLoading(false);
      }
    };
    void loadHouseholdMembers();
    return () => { isCurrent = false; };
  }, [user?.id, user?.sex]);

  useEffect(() => {
    let isCurrent = true;
    const loadCenters = async () => {
      try {
        const { data: result, fromCache } = await fetchJsonWithCache<EvacuationCenter[]>('/api/v1/centers');
        if (!isCurrent) return;
        const availableCenters = result.filter((center) => center.status !== 'closed' && center.status !== 'full' && center.current_occupancy < center.capacity);
        setCenters(availableCenters);
        setCenterError(availableCenters.length
          ? (fromCache ? 'Offline: showing saved evacuation centers. Availability may be out of date; your registration will be sent once you reconnect.' : '')
          : 'No evacuation centers are currently accepting registrations.');
      } catch {
        if (isCurrent) setCenterError('Unable to load evacuation centers. Connect to the internet once so they can be saved for offline use.');
      } finally {
        if (isCurrent) setIsCentersLoading(false);
      }
    };
    void loadCenters();
    return () => { isCurrent = false; };
  }, []);

  const selectedCenter = centers.find((center) => center.id === centerId);
  const visibleCenters = useMemo(() => {
    const query = centerSearch.trim().toLocaleLowerCase();
    return centers
      .filter((center) => centerFilter === 'all' || center.status === centerFilter)
      .filter((center) => !query || `${center.name} ${center.location}`.toLocaleLowerCase().includes(query))
      .sort((left, right) => {
        if (centerSort === 'spaces') return availableSpaces(right) - availableSpaces(left) || left.name.localeCompare(right.name);
        if (centerSort === 'occupancy') return occupancyRatio(left) - occupancyRatio(right) || left.name.localeCompare(right.name);
        return left.name.localeCompare(right.name);
      });
  }, [centers, centerFilter, centerSearch, centerSort]);

  const openMemberEditor = (index: number | null = null, returnToReviewAfterSave = false) => {
    setReturnToReview(returnToReviewAfterSave);
    if (returnToReviewAfterSave) setReviewVisible(false);
    setEditingMemberIndex(index);
    setMemberDraft(memberToDraft(index == null ? undefined : members[index]));
    setMemberError('');
    setMemberEditorOpen(true);
  };

  const closeMemberEditor = () => {
    setMemberEditorOpen(false);
    if (returnToReview) {
      setReviewVisible(true);
      setReturnToReview(false);
    }
  };

  const removeMember = (index: number) => {
    setMembers((current) => current.filter((_member, memberIndex) => memberIndex !== index));
  };

  const saveMember = () => {
    const validationMessage = validateMemberDraft(memberDraft);
    if (validationMessage) {
      setMemberError(validationMessage);
      return;
    }
    const nextMember = draftToMember(memberDraft, editingMemberIndex == null ? undefined : members[editingMemberIndex]?.id);
    if (editingMemberIndex == null && members.length >= 20) {
      setMemberError('A household can include up to 21 people, including the registrant.');
      return;
    }
    setMembers((current) => editingMemberIndex == null
      ? [...current, nextMember]
      : current.map((member, index) => index === editingMemberIndex ? nextMember : member));
    closeMemberEditor();
  };

  const validateRegistration = () => {
    const parsedAge = Number(age);
    const normalizedContact = contactNumber.replace(/[\s()-]/g, '');
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !age.trim() ||
      !Number.isInteger(parsedAge) ||
      parsedAge < 0 ||
      parsedAge > 150 ||
      !sex ||
      !/^(09\d{9}|\+639\d{9}|639\d{9})$/.test(normalizedContact) ||
      !address.trim() ||
      !selectedCenter ||
      selectedCenter.status === 'closed' ||
      selectedCenter.status === 'full' ||
      selectedCenter.current_occupancy >= selectedCenter.capacity ||
      members.some((member) => !isMemberComplete(member))
    ) {
      setFormError('Complete the required details and each household member, and choose a center that is accepting registrations.');
      return false;
    }
    setFormError('');
    return true;
  };

  const openReview = () => {
    if (isHouseholdLoading) return;
    if (validateRegistration()) setReviewVisible(true);
  };

  const submitRegistration = async () => {
    const parsedAge = Number(age);
    const normalizedContact = contactNumber.replace(/[\s()-]/g, '');
    if (!validateRegistration()) return;
    const householdSize = members.length + 1;

    setIsSubmitting(true);
    const payload = {
      id: `evac-registration-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      centerId,
      firstName: firstName.trim(),
      middleName: middleName.trim() || null,
      lastName: lastName.trim(),
      age: parsedAge,
      sex,
      contactNumber: normalizedContact,
      address: address.trim(),
      householdSize,
      members: members.map((member) => draftToMember(memberToDraft(member))),
    };
    let response: Response;
    try {
      response = await authenticatedFetch('/api/v1/resident/evacuation-registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      const queued = saveLocalEvacuationRegistration({ ...payload, centerName: selectedCenter?.name });
      setIsSubmitting(false);
      if (queued) {
        void syncPendingLocalData().catch(() => undefined);
        Alert.alert('Saved offline', 'No connection. Your registration is saved on this device and will be sent automatically once you are back online.');
        router.push('/(resident)/verify-status');
      } else {
        Alert.alert('Registration failed', 'No connection. Please try again when you are online.');
      }
      return;
    }
    try {
      const result = await response.json() as { detail?: unknown };
      if (!response.ok) throw new Error(readApiError(result.detail));
      try {
        const profileResponse = await authenticatedFetch('/api/v1/auth/me');
        if (profileResponse.ok) await setAuthenticatedUser(await profileResponse.json());
      } catch {
      }
      setReviewVisible(false);
      setRegistrationSuccessVisible(true);
    } catch (error) {
      Alert.alert('Registration failed', error instanceof Error ? error.message : 'The registration could not be saved.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GradientHeader title="Register Evacuee" subtitle="Reserve a safe space for your household" icon="home-heart" />

        {isCheckingExistingRegistration ? (
          <View style={styles.registrationGuard}>
            <ActivityIndicator color={GREEN} />
            <Text style={styles.registrationGuardText}>Checking for an existing evacuation registration...</Text>
          </View>
        ) : existingRegistration ? (
          <View style={styles.registrationGuard}>
            <MaterialCommunityIcons name="clipboard-check-outline" size={36} color={GREEN} />
            <Text style={styles.registrationGuardTitle}>Your household is already registered</Text>
            <Text style={styles.registrationGuardText}>Pending at {existingRegistration.centerName}. View the current status to change the center or cancel this registration.</Text>
            <AnimatedPressable style={styles.manageRegistrationButton} onPress={() => router.push('/(resident)/verify-status')} accessibilityRole="button">
              <Text style={styles.manageRegistrationText}>Manage registration</Text>
            </AnimatedPressable>
          </View>
        ) : <View style={styles.form}>
          <SectionCard index={0} title="Your details" icon="account-outline">
            <Field label="First name" required placeholder="Enter first name" value={firstName} onChangeText={setFirstName} />
            <Field label="Middle name" placeholder="Enter middle name" value={middleName} onChangeText={setMiddleName} />
            <Field label="Last name" required placeholder="Enter last name" value={lastName} onChangeText={setLastName} />
            <Field label="Age" required placeholder="Years" keyboardType="number-pad" maxLength={3} value={age} onChangeText={setAge} />
            <SexToggle value={sex} onChange={setSex} fromAccount={!!normalizeSex(user?.sex) && sex === normalizeSex(user?.sex)} />
            <Field label="Contact number" required placeholder="(+63) 900-000-0000" keyboardType="phone-pad" value={contactNumber} onChangeText={setContactNumber} />
            <Field label="Address" required placeholder="Enter full address" value={address} onChangeText={setAddress} />
          </SectionCard>

          <View style={styles.householdHeading}>
            <View><Text style={styles.sectionHeading}>HOUSEHOLD MEMBERS</Text><Text style={styles.householdCount}>{members.length + 1} people including you</Text></View>
            <AnimatedPressable style={[styles.addMemberButton, (isHouseholdLoading || members.length >= 20) && styles.submitDisabled]} onPress={() => openMemberEditor()} disabled={isHouseholdLoading || members.length >= 20} accessibilityRole="button" accessibilityLabel="Add household member">
              <MaterialCommunityIcons name="plus" size={17} color={Colors.white} /><Text style={styles.addMemberText}>Add member</Text>
            </AnimatedPressable>
          </View>
          <View style={styles.formRest}>
          {isHouseholdLoading && <View style={styles.householdLoading}><ActivityIndicator color={GREEN} size="small" /><Text style={styles.householdCount}>Loading saved household members...</Text></View>}
          {members.length === 0 && <Text style={styles.noMembers}>No additional household members yet. Use Add member to include them in this registration.</Text>}
          {members.map((member, index) => (
            <View key={`${index}-${member.name}`} style={styles.memberCard}>
              <View style={styles.memberCopy}><Text style={styles.memberName}>{member.name}</Text><Text style={styles.memberRelationship}>{memberSummary(member)}</Text></View>
              <AnimatedPressable style={styles.memberAction} onPress={() => openMemberEditor(index)} accessibilityRole="button" accessibilityLabel={`Edit ${member.name}`}><MaterialCommunityIcons name="pencil-outline" size={19} color="#1769AA" /></AnimatedPressable>
              <AnimatedPressable style={styles.memberAction} onPress={() => removeMember(index)} accessibilityRole="button" accessibilityLabel={`Remove household member ${member.name}`}><MaterialCommunityIcons name="trash-can-outline" size={19} color={Colors.emergency} /></AnimatedPressable>
            </View>
          ))}
          {!!formError && <Text style={styles.formError}>{formError}</Text>}
          <FieldLabel label="Choose a barangay center" required />
          <View style={styles.centerSearchBox}>
            <MaterialCommunityIcons name="magnify" size={19} color={Colors.textMuted} />
            <TextInput value={centerSearch} onChangeText={setCenterSearch} placeholder="Search center or barangay" placeholderTextColor={Colors.textMuted} style={styles.centerSearchInput} returnKeyType="search" accessibilityLabel="Search evacuation centers" />
            {!!centerSearch && <Pressable onPress={() => setCenterSearch('')} style={styles.clearCenterSearch} accessibilityRole="button" accessibilityLabel="Clear center search"><MaterialCommunityIcons name="close-circle" size={18} color={Colors.textMuted} /></Pressable>}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.centerFilterList}>
            {([
              ['all', 'All centers'],
              ['available', 'Available'],
              ['limited', 'Limited'],
            ] as const).map(([filter, label]) => {
              const isSelected = centerFilter === filter;
              return <Pressable key={filter} style={[styles.centerFilterChip, isSelected && styles.centerFilterChipSelected]} onPress={() => setCenterFilter(filter)} accessibilityRole="button" accessibilityState={{ selected: isSelected }}>
                <Text style={[styles.centerFilterText, isSelected && styles.centerFilterTextSelected]}>{label}</Text>
              </Pressable>;
            })}
          </ScrollView>
          <View style={styles.centerSortHeading}><Text style={styles.centerResults}>{visibleCenters.length} of {centers.length} accepting centers</Text><MaterialCommunityIcons name="sort" size={16} color={Colors.textMuted} /></View>
          <View style={styles.centerSortControl} accessibilityRole="radiogroup" accessibilityLabel="Sort evacuation centers">
            {([
              ['name', 'A–Z'],
              ['spaces', 'Most spaces'],
              ['occupancy', 'Least full'],
            ] as const).map(([sort, label]) => {
              const isSelected = centerSort === sort;
              return <Pressable key={sort} style={[styles.centerSortOption, isSelected && styles.centerSortOptionSelected]} onPress={() => setCenterSort(sort)} accessibilityRole="radio" accessibilityState={{ checked: isSelected }}>
                <Text style={[styles.centerSortText, isSelected && styles.centerSortTextSelected]}>{label}</Text>
              </Pressable>;
            })}
          </View>
          <View style={styles.selectedCenterSummary}>
            <MaterialCommunityIcons name={selectedCenter ? 'map-marker-check-outline' : 'map-marker-outline'} size={19} color={GREEN} />
            <View style={styles.selectedCenterCopy}>
              <Text style={styles.selectedCenterLabel}>{selectedCenter ? 'SELECTED CENTER' : 'NO CENTER SELECTED'}</Text>
              <Text style={styles.selectedCenterName}>{selectedCenter?.name || 'Choose a center below'}</Text>
              {selectedCenter && <Text style={styles.selectedCenterDetail}>{selectedCenter.location} · {availableSpaces(selectedCenter)} spaces available</Text>}
            </View>
          </View>
          <AnimatedPressable style={[styles.submitButton, (!selectedCenter || isSubmitting || isCentersLoading || isHouseholdLoading) && styles.submitDisabled]} onPress={openReview} disabled={!selectedCenter || isSubmitting || isCentersLoading || isHouseholdLoading} accessibilityRole="button">
            <Text style={styles.submitText}>Review registration</Text>
          </AnimatedPressable>
          <View style={styles.centerList}>
            {isCentersLoading ? <ActivityIndicator color={GREEN} /> : centers.length === 0 ? <Text style={styles.centerError}>{centerError}</Text> : visibleCenters.length === 0 ? <Text style={styles.noCenterResults}>No centers match. Try another search or availability filter.</Text> : visibleCenters.map((center) => (
              <AnimatedPressable key={center.id} style={[styles.centerOption, centerId === center.id && styles.centerOptionSelected]} onPress={() => setCenterId(center.id)} accessibilityRole="radio" accessibilityState={{ selected: centerId === center.id }}>
                <View style={styles.centerCopy}>
                  <Text style={styles.centerName}>{center.name}</Text>
                  <Text style={styles.centerDetails}>{center.location} · {center.current_occupancy} of {center.capacity} people · {Math.max(0, center.capacity - center.current_occupancy)} spaces</Text>
                </View>
                {centerId === center.id && <MaterialCommunityIcons name="check-circle" size={18} color={GREEN} />}
              </AnimatedPressable>
            ))}
          </View>
          {!!centerError && centers.length > 0 && <Text style={styles.centerError}>{centerError}</Text>}
          </View>
        </View>}
      </ScrollView>

      <Modal visible={reviewVisible} transparent animationType="fade" onRequestClose={() => setReviewVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setReviewVisible(false)}>
          <Pressable style={styles.reviewDialog} onPress={(event) => event.stopPropagation()}>
            <View style={styles.reviewHeader}><Text style={styles.reviewTitle}>Confirm registration</Text><Pressable onPress={() => setReviewVisible(false)} accessibilityLabel="Close registration review"><MaterialCommunityIcons name="close" size={22} color="#315C34" /></Pressable></View>
            <ScrollView style={styles.reviewScroll} contentContainerStyle={styles.reviewContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.reviewSection}>ACCOUNT</Text>
              <ReviewRow label="Signed in as" value={user?.name || 'HANDA User'} />
              <ReviewRow label="Email" value={user?.email || 'Not available'} />
              <Text style={styles.reviewSection}>REGISTRANT</Text>
              <ReviewRow label="Name" value={[firstName, middleName, lastName].filter(Boolean).join(' ')} />
              <ReviewRow label="Age and sex" value={`${age} · ${sex}`} />
              <ReviewRow label="Contact" value={contactNumber} />
              <ReviewRow label="Address" value={address} />
              <Text style={styles.reviewSection}>PREFERRED CENTER</Text>
              {selectedCenter && <>
                <ReviewRow label="Center" value={selectedCenter.name} />
                <ReviewRow label="Location" value={selectedCenter.location} />
                <ReviewRow label="Capacity" value={`${selectedCenter.current_occupancy} of ${selectedCenter.capacity} people · ${Math.max(0, selectedCenter.capacity - selectedCenter.current_occupancy)} spaces available`} />
              </>}
              <View style={styles.reviewHouseholdHeading}><Text style={styles.reviewSection}>HOUSEHOLD ({members.length + 1})</Text><AnimatedPressable onPress={() => openMemberEditor(null, true)} accessibilityRole="button"><Text style={styles.reviewEditText}>Add member</Text></AnimatedPressable></View>
              {members.length === 0 ? <Text style={styles.householdCount}>No additional members</Text> : members.map((member, index) => (
                <View key={`review-${index}-${member.name}`} style={styles.reviewMemberRow}>
                  <View style={styles.memberCopy}><Text style={styles.memberName}>{member.name}</Text><Text style={styles.memberRelationship}>{memberSummary(member)}</Text></View>
                  <AnimatedPressable style={styles.memberAction} onPress={() => openMemberEditor(index, true)} accessibilityRole="button" accessibilityLabel={`Edit ${member.name}`}><MaterialCommunityIcons name="pencil-outline" size={18} color="#1769AA" /></AnimatedPressable>
                  <AnimatedPressable style={styles.memberAction} onPress={() => removeMember(index)} accessibilityRole="button" accessibilityLabel={`Remove ${member.name}`}><MaterialCommunityIcons name="trash-can-outline" size={18} color={Colors.emergency} /></AnimatedPressable>
                </View>
              ))}
            </ScrollView>
            <View style={styles.reviewActions}>
              <AnimatedPressable style={styles.cancelButton} onPress={() => setReviewVisible(false)} disabled={isSubmitting}><Text style={styles.cancelText}>Edit details</Text></AnimatedPressable>
              <AnimatedPressable style={styles.confirmButton} onPress={() => void submitRegistration()} disabled={isSubmitting} accessibilityRole="button">
                {isSubmitting ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.confirmText}>Confirm registration</Text>}
              </AnimatedPressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={registrationSuccessVisible} transparent animationType="fade" onRequestClose={() => setRegistrationSuccessVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.successDialog}>
            <MaterialCommunityIcons name="check-circle" size={48} color={GREEN} />
            <Text style={styles.successTitle}>Registration successful</Text>
            <Text style={styles.successMessage}>Your household is registered for evacuation at {selectedCenter?.name || 'the selected center'}. A responder must confirm your check-in.</Text>
            <AnimatedPressable
              style={styles.confirmButton}
              onPress={() => {
                setRegistrationSuccessVisible(false);
                router.push('/(resident)/verify-status');
              }}
              accessibilityRole="button"
            >
              <Text style={styles.confirmText}>View status</Text>
            </AnimatedPressable>
          </View>
        </View>
      </Modal>

      <Modal visible={memberEditorOpen} transparent animationType="fade" onRequestClose={closeMemberEditor}>
        <Pressable style={styles.modalBackdrop} onPress={closeMemberEditor}>
          <Pressable style={styles.memberDialog} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.reviewTitle}>{editingMemberIndex == null ? 'Add household member' : 'Edit household member'}</Text>
            <ScrollView style={styles.memberFormScroll} keyboardShouldPersistTaps="handled">
              <HouseholdMemberFields draft={memberDraft} onChange={setMemberDraft} relationshipPlaceholder="Relationship to registrant" />
            </ScrollView>
            {!!memberError && <Text style={styles.formError}>{memberError}</Text>}
            <View style={styles.reviewActions}>
              <AnimatedPressable style={styles.cancelButton} onPress={closeMemberEditor}><Text style={styles.cancelText}>Cancel</Text></AnimatedPressable>
              <AnimatedPressable style={styles.confirmButton} onPress={saveMember}><Text style={styles.confirmText}>Save member</Text></AnimatedPressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.reviewRow}><Text style={styles.reviewLabel}>{label}</Text><Text style={styles.reviewValue}>{value || 'Not provided'}</Text></View>;
}

function FieldLabel({ label, required = false }: { label: string; required?: boolean }) {
  return <Text style={styles.label}>{label}{required && <Text style={styles.required}> *</Text>}</Text>;
}

function readApiError(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const messages = detail.flatMap((issue: unknown) => issue && typeof issue === 'object' && 'msg' in issue && typeof issue.msg === 'string' ? [issue.msg] : []);
    if (messages.length) return messages.join('\n');
  }
  return 'Check the entered details and try again.';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 12 },
  titleBand: { backgroundColor: GREEN, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 9 },
  title: { color: Colors.white, fontSize: 20, fontWeight: '800', lineHeight: 22 },
  centerSearchBox: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10, paddingHorizontal: 12, borderWidth: 1.5, borderColor: '#D9E3D9', borderRadius: 14, backgroundColor: Colors.surface },
  centerSearchInput: { minWidth: 0, flex: 1, height: 42, padding: 0, color: Colors.text, fontSize: 13 },
  clearCenterSearch: { width: 30, height: 36, alignItems: 'center', justifyContent: 'center' },
  centerFilterList: { gap: 8, paddingTop: 10, paddingBottom: 2 },
  centerFilterChip: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1.5, borderColor: '#D9E3D9', borderRadius: 17, backgroundColor: Colors.surface },
  centerFilterChipSelected: { borderColor: GREEN, backgroundColor: GREEN },
  centerFilterText: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },
  centerFilterTextSelected: { color: Colors.white },
  centerSortHeading: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  centerResults: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },
  centerSortControl: { flexDirection: 'row', gap: 3, padding: 3, borderRadius: 12, backgroundColor: '#E8EEE8' },
  centerSortOption: { minHeight: 34, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderRadius: 9 },
  centerSortOptionSelected: { backgroundColor: Colors.surface },
  centerSortText: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  centerSortTextSelected: { color: GREEN },
  selectedCenterSummary: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, borderColor: '#A8CFA8', borderRadius: 14, backgroundColor: '#F1F7F1' },
  selectedCenterCopy: { flex: 1, minWidth: 0 },
  selectedCenterLabel: { color: GREEN, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  selectedCenterName: { color: Colors.text, fontSize: 13, fontWeight: '800', marginTop: 2 },
  selectedCenterDetail: { color: Colors.textMuted, fontSize: 10, lineHeight: 14, marginTop: 1 },
  noCenterResults: { paddingVertical: 15, color: Colors.textMuted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  form: { paddingBottom: 24 },
  formRest: { paddingHorizontal: 14 },
  registrationGuard: { minHeight: 260, margin: 16, alignItems: 'center', justifyContent: 'center', padding: 24, borderWidth: 1, borderColor: '#B5D4B5', borderRadius: 7, backgroundColor: Colors.surface, gap: 10 },
  registrationGuardTitle: { color: '#1E5322', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  registrationGuardText: { maxWidth: 360, color: Colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  manageRegistrationButton: { minHeight: 44, marginTop: 6, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 5, backgroundColor: GREEN },
  manageRegistrationText: { color: Colors.white, fontSize: 12, fontWeight: '800' },
  sectionHeading: { color: Colors.text, fontFamily: 'Sora_700Bold', fontSize: 14 },
  label: { color: Colors.text, fontFamily: 'Sora_700Bold', fontSize: 14, marginTop: 20, marginBottom: 2 },
  required: { color: '#D33D3D' },
  input: { height: 31, borderWidth: 1, borderColor: Colors.border, borderRadius: 6, paddingHorizontal: 12, color: FIELD_GREEN, fontSize: 10, backgroundColor: Colors.surface },
  inlineFields: { flexDirection: 'row', gap: 10 },
  inlineFieldsStacked: { flexDirection: 'column', gap: 0 },
  halfField: { flex: 1, minWidth: 0 },
  halfFieldStacked: { flex: 0 },
  memberFields: { marginTop: 2, paddingLeft: 9, borderLeftWidth: 2, borderLeftColor: '#A6CFA7' },
  selectField: { width: '100%', height: 31, borderWidth: 1, borderColor: Colors.border, borderRadius: 6, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF' },
  openPickerField: { zIndex: 10 },
  fieldText: { color: FIELD_GREEN, fontSize: 10 },
  placeholder: { color: '#A6C1A7' },
  sexOptions: { position: 'absolute', top: 58, left: 0, right: 0, zIndex: 20, borderWidth: 1, borderColor: '#79B879', borderRadius: 6, backgroundColor: '#FFFFFF', opacity: 1, elevation: 8, shadowColor: '#000000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 6 },
  sexOption: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E3EDE3', backgroundColor: '#FFFFFF' },
  centerList: { gap: 10, marginTop: 10 },
  centerOption: { minHeight: 58, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5, borderColor: '#E0EAE0', borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF' },
  centerOptionSelected: { borderColor: GREEN, backgroundColor: '#EEF7EE' },
  centerCopy: { flex: 1 },
  centerName: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  centerDetails: { color: Colors.textMuted, fontSize: 11, marginTop: 3 },
  centerError: { color: '#A34545', fontSize: 11, paddingVertical: 6 },
  submitButton: { height: 52, backgroundColor: GREEN, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  submitDisabled: { opacity: 0.55 },
  submitText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  householdHeading: { marginHorizontal: 14, marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  householdCount: { color: Colors.textMuted, fontSize: 11, marginTop: 3 },
  householdLoading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  noMembers: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 8 },
  addMemberButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 14, borderRadius: 14, backgroundColor: GREEN },
  addMemberText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  memberCard: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingLeft: 14, borderWidth: 1, borderColor: '#E0EAE0', borderLeftWidth: 5, borderLeftColor: GREEN, borderRadius: 16, backgroundColor: '#FFFFFF' },
  memberCopy: { flex: 1, minWidth: 0 },
  memberFormScroll: { maxHeight: 420 },
  memberName: { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
  memberRelationship: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  memberAction: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  formError: { color: Colors.emergency, fontSize: 11, marginTop: 8 },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 18, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  reviewDialog: { width: '100%', maxWidth: 520, maxHeight: '92%', padding: 16, borderRadius: 8, backgroundColor: Colors.surface },
  successDialog: { width: '100%', maxWidth: 420, alignItems: 'center', padding: 24, borderRadius: 8, backgroundColor: Colors.surface },
  successTitle: { marginTop: 12, color: Colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  successMessage: { marginTop: 8, color: Colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#E5EDE5' },
  reviewTitle: { color: Colors.text, fontSize: 18, fontWeight: '800', flex: 1 },
  reviewScroll: { flexShrink: 1 },
  reviewContent: { paddingBottom: 8 },
  reviewSection: { color: '#218B25', fontSize: 10, fontWeight: '900', marginTop: 13, marginBottom: 3 },
  reviewRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#F0F3F0' },
  reviewLabel: { width: 96, color: Colors.textMuted, fontSize: 10, fontWeight: '600' },
  reviewValue: { flex: 1, color: Colors.textMuted, fontSize: 11, fontWeight: '600' },
  reviewHouseholdHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewEditText: { color: '#1769AA', fontSize: 11, fontWeight: '700' },
  reviewMemberRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 8, borderTopWidth: 1, borderTopColor: '#EDF2ED' },
  reviewActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  cancelButton: { minHeight: 44, minWidth: 92, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border, borderRadius: 5 },
  cancelText: { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
  confirmButton: { minHeight: 44, minWidth: 146, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 5, backgroundColor: GREEN },
  confirmText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  memberDialog: { width: '100%', maxWidth: 400, padding: 18, borderRadius: 8, backgroundColor: Colors.surface },
  memberInput: { minHeight: 44, marginTop: 12, paddingHorizontal: 10, borderWidth: 1, borderColor: Colors.border, borderRadius: 5, color: Colors.textMuted, fontSize: 14 },
});