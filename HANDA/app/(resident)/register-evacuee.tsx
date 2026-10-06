import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import { AnimatedPressable } from '@components/Buttons';
import { authenticatedFetch } from '@services/apiClient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@hooks/useAuth';
import { useResponsiveLayout } from '@hooks/useResponsiveLayout';

const GREEN = '#218B25';
const FIELD_GREEN = '#548B56';
const SEXES = ['Female', 'Male', 'Other'];

type EvacuationCenter = {
  id: string;
  name: string;
  location: string;
  capacity: number;
  current_occupancy: number;
  status: 'available' | 'limited' | 'full' | 'closed';
};

type HouseholdMemberDraft = { name: string; relationship: string };

export default function RegisterEvacueeScreen() {
  const { centerId: routeCenterId } = useLocalSearchParams<{ centerId?: string }>();
  const requestedCenterId = Array.isArray(routeCenterId) ? routeCenterId[0] : routeCenterId;
  const { isCompact } = useResponsiveLayout();
  const { user } = useAuth();
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [isSexOpen, setIsSexOpen] = useState(false);
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');
  const [centerId, setCenterId] = useState(requestedCenterId ?? '');
  const [centers, setCenters] = useState<EvacuationCenter[]>([]);
  const [isCentersLoading, setIsCentersLoading] = useState(true);
  const [centerError, setCenterError] = useState('');
  const [members, setMembers] = useState<HouseholdMemberDraft[]>([]);
  const [memberEditorOpen, setMemberEditorOpen] = useState(false);
  const [editingMemberIndex, setEditingMemberIndex] = useState<number | null>(null);
  const [memberName, setMemberName] = useState('');
  const [memberRelationship, setMemberRelationship] = useState('');
  const [memberError, setMemberError] = useState('');
  const [returnToReview, setReturnToReview] = useState(false);
  const [formError, setFormError] = useState('');
  const [reviewVisible, setReviewVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (requestedCenterId) setCenterId(requestedCenterId);
  }, [requestedCenterId]);

  useEffect(() => {
    const nameParts = user?.name.trim().split(/\s+/).filter(Boolean) ?? [];
    if (!nameParts.length) return;
    setFirstName((current) => current || nameParts[0]);
    setLastName((current) => current || nameParts.slice(1).join(' '));
  }, [user]);

  useEffect(() => {
    let isCurrent = true;
    const loadCenters = async () => {
      try {
        const response = await authenticatedFetch('/api/v1/centers');
        if (!response.ok) throw new Error('Evacuation centers could not be loaded.');
        const result = await response.json() as EvacuationCenter[];
        if (!isCurrent) return;
        const availableCenters = result.filter((center) => center.status !== 'closed' && center.status !== 'full' && center.current_occupancy < center.capacity);
        setCenters(availableCenters);
        setCenterError(availableCenters.length ? '' : 'No evacuation centers are currently accepting registrations.');
      } catch {
        if (isCurrent) setCenterError('Unable to load evacuation centers. Check your connection and try again.');
      } finally {
        if (isCurrent) setIsCentersLoading(false);
      }
    };
    void loadCenters();
    return () => { isCurrent = false; };
  }, []);

  const selectedCenter = centers.find((center) => center.id === centerId);

  const openMemberEditor = (index: number | null = null, returnToReviewAfterSave = false) => {
    setReturnToReview(returnToReviewAfterSave);
    if (returnToReviewAfterSave) setReviewVisible(false);
    setEditingMemberIndex(index);
    setMemberName(index == null ? '' : members[index].name);
    setMemberRelationship(index == null ? '' : members[index].relationship);
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
    const nextMember = { name: memberName.trim(), relationship: memberRelationship.trim() };
    if (!nextMember.name || !nextMember.relationship) {
      setMemberError('Enter the member name and relationship.');
      return;
    }
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
      members.some((member) => !member.name.trim() || !member.relationship.trim())
    ) {
      setFormError('Complete the required details and each household member, and choose a center that is accepting registrations.');
      return false;
    }
    setFormError('');
    return true;
  };

  const openReview = () => {
    if (validateRegistration()) setReviewVisible(true);
  };

  const submitRegistration = async () => {
    const parsedAge = Number(age);
    const normalizedContact = contactNumber.replace(/[\s()-]/g, '');
    if (!validateRegistration()) return;
    const householdSize = members.length + 1;

    setIsSubmitting(true);
    try {
      const response = await authenticatedFetch('/api/v1/resident/evacuation-registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          centerId,
          firstName: firstName.trim(),
          middleName: middleName.trim() || null,
          lastName: lastName.trim(),
          age: parsedAge,
          sex,
          contactNumber: normalizedContact,
          address: address.trim(),
          householdSize,
          members: members.map((member) => ({ name: member.name.trim(), relationship: member.relationship.trim() })),
        }),
      });
      const result = await response.json() as { detail?: unknown };
      if (!response.ok) throw new Error(readApiError(result.detail));
      setReviewVisible(false);
      Alert.alert('Registration submitted', 'Your household is registered at the selected center. A responder must confirm your check-in.', [
        { text: 'View status', onPress: () => router.push('/(resident)/verify-status') },
      ]);
    } catch (error) {
      Alert.alert('Registration failed', error instanceof Error ? error.message : 'The registration could not be saved.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBand}>
          <Text style={styles.title}>REGISTER</Text>
          <Text style={styles.title}>EVACUEE</Text>
        </View>

        <View style={styles.form}>
          <FieldLabel label="First Name" required />
          <TextInput style={styles.input} placeholder="Enter first name" placeholderTextColor="#A6C1A7" value={firstName} onChangeText={setFirstName} />
          <FieldLabel label="Middle Name" />
          <TextInput style={styles.input} placeholder="Enter middle name" placeholderTextColor="#A6C1A7" value={middleName} onChangeText={setMiddleName} />
          <FieldLabel label="Last Name" required />
          <TextInput style={styles.input} placeholder="Enter last name" placeholderTextColor="#A6C1A7" value={lastName} onChangeText={setLastName} />

          <View style={[styles.inlineFields, isCompact && styles.inlineFieldsStacked]}>
            <View style={[styles.halfField, isCompact && styles.halfFieldStacked]}>
              <FieldLabel label="Age" required />
              <TextInput style={styles.input} placeholder="Years" placeholderTextColor="#A6C1A7" keyboardType="number-pad" value={age} onChangeText={setAge} />
            </View>
            <View style={[styles.halfField, isCompact && styles.halfFieldStacked]}>
              <FieldLabel label="Sex" required />
              <AnimatedPressable style={styles.selectField} onPress={() => setIsSexOpen((open) => !open)}>
                <Text style={[styles.fieldText, !sex && styles.placeholder]}>{sex || 'Select'}</Text>
                <MaterialCommunityIcons name={isSexOpen ? 'chevron-up' : 'chevron-down'} size={18} color={GREEN} />
              </AnimatedPressable>
              {isSexOpen && (
                <View style={styles.sexOptions}>
                  {SEXES.map((item) => <AnimatedPressable key={item} style={styles.sexOption} onPress={() => { setSex(item); setIsSexOpen(false); }}><Text style={styles.fieldText}>{item}</Text></AnimatedPressable>)}
                </View>
              )}
            </View>
          </View>

          <FieldLabel label="Contact Number" required />
          <TextInput style={styles.input} placeholder="(+63) 900-000-0000" placeholderTextColor="#A6C1A7" keyboardType="phone-pad" value={contactNumber} onChangeText={setContactNumber} />

          <Text style={styles.sectionHeading}>HOUSEHOLD INFORMATION</Text>
          <FieldLabel label="Address" required />
          <TextInput style={styles.input} placeholder="Enter Full Address" placeholderTextColor="#A6C1A7" value={address} onChangeText={setAddress} />
          <View style={styles.householdHeading}>
            <View><Text style={styles.sectionHeading}>HOUSEHOLD MEMBERS</Text><Text style={styles.householdCount}>{members.length + 1} people including you</Text></View>
            <AnimatedPressable style={styles.addMemberButton} onPress={() => openMemberEditor()} disabled={members.length >= 20} accessibilityRole="button">
              <MaterialCommunityIcons name="plus" size={17} color={Colors.white} /><Text style={styles.addMemberText}>Add member</Text>
            </AnimatedPressable>
          </View>
          {members.map((member, index) => (
            <View key={`${index}-${member.name}`} style={styles.memberCard}>
              <View style={styles.memberCopy}><Text style={styles.memberName}>{member.name}</Text><Text style={styles.memberRelationship}>{member.relationship}</Text></View>
              <AnimatedPressable style={styles.memberAction} onPress={() => openMemberEditor(index)} accessibilityRole="button" accessibilityLabel={`Edit ${member.name}`}><MaterialCommunityIcons name="pencil-outline" size={19} color="#1769AA" /></AnimatedPressable>
              <AnimatedPressable style={styles.memberAction} onPress={() => removeMember(index)} accessibilityRole="button" accessibilityLabel={`Remove ${member.name}`}><MaterialCommunityIcons name="trash-can-outline" size={19} color={Colors.emergency} /></AnimatedPressable>
            </View>
          ))}
          {!!formError && <Text style={styles.formError}>{formError}</Text>}
          <FieldLabel label="Barangay Center" required />
          <View style={styles.centerList}>
            {isCentersLoading ? <ActivityIndicator color={GREEN} /> : centers.length === 0 ? <Text style={styles.centerError}>{centerError}</Text> : centers.map((center) => (
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

          <AnimatedPressable style={[styles.submitButton, (isSubmitting || isCentersLoading || centers.length === 0) && styles.submitDisabled]} onPress={openReview} disabled={isSubmitting || isCentersLoading || centers.length === 0}>
            <Text style={styles.submitText}>Review registration</Text>
          </AnimatedPressable>
        </View>
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
                  <View style={styles.memberCopy}><Text style={styles.memberName}>{member.name}</Text><Text style={styles.memberRelationship}>{member.relationship}</Text></View>
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

      <Modal visible={memberEditorOpen} transparent animationType="fade" onRequestClose={closeMemberEditor}>
        <Pressable style={styles.modalBackdrop} onPress={closeMemberEditor}>
          <Pressable style={styles.memberDialog} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.reviewTitle}>{editingMemberIndex == null ? 'Add household member' : 'Edit household member'}</Text>
            <TextInput style={styles.memberInput} value={memberName} onChangeText={setMemberName} placeholder="Full name" placeholderTextColor="#79967A" />
            <TextInput style={styles.memberInput} value={memberRelationship} onChangeText={setMemberRelationship} placeholder="Relationship to registrant" placeholderTextColor="#79967A" />
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
  container: { flex: 1, backgroundColor: Colors.white },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 12 },
  titleBand: { backgroundColor: GREEN, paddingHorizontal: 14, paddingTop: 18, paddingBottom: 9 },
  title: { color: Colors.white, fontSize: 20, fontWeight: '800', lineHeight: 22 },
  form: { paddingHorizontal: 14, paddingBottom: 12 },
  sectionHeading: { color: '#236B27', fontSize: 18, marginTop: 12, marginBottom: 1 },
  label: { color: FIELD_GREEN, fontSize: 9, marginTop: 8, marginBottom: 4 },
  required: { color: '#D33D3D' },
  input: { height: 31, borderWidth: 1, borderColor: '#D9D9D9', borderRadius: 6, paddingHorizontal: 12, color: FIELD_GREEN, fontSize: 10, backgroundColor: Colors.white },
  inlineFields: { flexDirection: 'row', gap: 10 },
  inlineFieldsStacked: { flexDirection: 'column', gap: 0 },
  halfField: { flex: 1 },
  halfFieldStacked: { flex: 0 },
  memberFields: { marginTop: 2, paddingLeft: 9, borderLeftWidth: 2, borderLeftColor: '#A6CFA7' },
  selectField: { height: 31, borderWidth: 1, borderColor: '#D9D9D9', borderRadius: 6, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldText: { color: FIELD_GREEN, fontSize: 10 },
  placeholder: { color: '#A6C1A7' },
  sexOptions: { position: 'absolute', top: 58, left: 0, right: 0, zIndex: 2, borderWidth: 1, borderColor: '#79B879', borderRadius: 6, backgroundColor: Colors.white },
  sexOption: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E3EDE3' },
  centerList: { gap: 7, marginTop: 2 },
  centerOption: { minHeight: 46, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: '#D9D9D9', borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  centerOptionSelected: { borderColor: GREEN, backgroundColor: '#F0F7F0' },
  centerCopy: { flex: 1 },
  centerName: { color: FIELD_GREEN, fontSize: 11, fontWeight: '700' },
  centerDetails: { color: '#79967A', fontSize: 9, marginTop: 3 },
  centerError: { color: '#A34545', fontSize: 10, paddingVertical: 6 },
  submitButton: { height: 38, backgroundColor: GREEN, borderRadius: 5, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  submitDisabled: { opacity: 0.55 },
  submitText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  householdHeading: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  householdCount: { color: '#617461', fontSize: 10, marginTop: 3 },
  addMemberButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 10, borderRadius: 5, backgroundColor: GREEN },
  addMemberText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  memberCard: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingLeft: 10, borderWidth: 1, borderColor: '#D9E6D9', borderRadius: 6, backgroundColor: '#F7FAF7' },
  memberCopy: { flex: 1, minWidth: 0 },
  memberName: { color: '#263B28', fontSize: 12, fontWeight: '700' },
  memberRelationship: { color: '#617461', fontSize: 10, marginTop: 2 },
  memberAction: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  formError: { color: Colors.emergency, fontSize: 11, marginTop: 8 },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 18, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  reviewDialog: { width: '100%', maxWidth: 520, maxHeight: '92%', padding: 16, borderRadius: 8, backgroundColor: Colors.white },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#E5EDE5' },
  reviewTitle: { color: '#17591D', fontSize: 18, fontWeight: '800', flex: 1 },
  reviewScroll: { flexShrink: 1 },
  reviewContent: { paddingBottom: 8 },
  reviewSection: { color: '#218B25', fontSize: 10, fontWeight: '900', marginTop: 13, marginBottom: 3 },
  reviewRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#F0F3F0' },
  reviewLabel: { width: 96, color: '#617461', fontSize: 10, fontWeight: '600' },
  reviewValue: { flex: 1, color: '#263B28', fontSize: 11, fontWeight: '600' },
  reviewHouseholdHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewEditText: { color: '#1769AA', fontSize: 11, fontWeight: '700' },
  reviewMemberRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 8, borderTopWidth: 1, borderTopColor: '#EDF2ED' },
  reviewActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  cancelButton: { minHeight: 44, minWidth: 92, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: '#CCD7CC', borderRadius: 5 },
  cancelText: { color: '#344054', fontSize: 12, fontWeight: '700' },
  confirmButton: { minHeight: 44, minWidth: 146, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 5, backgroundColor: GREEN },
  confirmText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  memberDialog: { width: '100%', maxWidth: 400, padding: 18, borderRadius: 8, backgroundColor: Colors.white },
  memberInput: { minHeight: 44, marginTop: 12, paddingHorizontal: 10, borderWidth: 1, borderColor: '#D9E6D9', borderRadius: 5, color: '#263B28', fontSize: 14 },
});