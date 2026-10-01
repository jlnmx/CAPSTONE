import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import { AnimatedPressable } from '@components/Buttons';
import { authenticatedFetch } from '@services/apiClient';
import { useRouter } from 'expo-router';

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
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [isSexOpen, setIsSexOpen] = useState(false);
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');
  const [householdSize, setHouseholdSize] = useState('');
  const [centerId, setCenterId] = useState('');
  const [centers, setCenters] = useState<EvacuationCenter[]>([]);
  const [isCentersLoading, setIsCentersLoading] = useState(true);
  const [centerError, setCenterError] = useState('');
  const [members, setMembers] = useState<HouseholdMemberDraft[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const updateHouseholdSize = (value: string) => {
    setHouseholdSize(value);
    const count = Number(value);
    if (Number.isInteger(count) && count >= 1 && count <= 21) {
      setMembers((current) => Array.from({ length: count - 1 }, (_, index) => current[index] ?? { name: '', relationship: '' }));
    } else {
      setMembers([]);
    }
  };

  const submitRegistration = async () => {
    const parsedAge = Number(age);
    const parsedHouseholdSize = Number(householdSize);
    const normalizedContact = contactNumber.replace(/[\s()-]/g, '');
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !age.trim() ||
      !Number.isInteger(parsedAge) ||
      parsedAge < 0 ||
      parsedAge > 150 ||
      !Number.isInteger(parsedHouseholdSize) ||
      parsedHouseholdSize < 1 ||
      parsedHouseholdSize > 21 ||
      !sex ||
      !/^(09\d{9}|\+639\d{9}|639\d{9})$/.test(normalizedContact) ||
      !address.trim() ||
      !centerId ||
      members.length !== parsedHouseholdSize - 1 ||
      members.some((member) => !member.name.trim() || !member.relationship.trim())
    ) {
      Alert.alert('Check the form', 'Complete all required fields and provide each household member\'s name and relationship.');
      return;
    }

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
          householdSize: parsedHouseholdSize,
          members: members.map((member) => ({ name: member.name.trim(), relationship: member.relationship.trim() })),
        }),
      });
      const result = await response.json() as { detail?: unknown };
      if (!response.ok) throw new Error(readApiError(result.detail));
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

          <View style={styles.inlineFields}>
            <View style={styles.halfField}>
              <FieldLabel label="Age" required />
              <TextInput style={styles.input} placeholder="Years" placeholderTextColor="#A6C1A7" keyboardType="number-pad" value={age} onChangeText={setAge} />
            </View>
            <View style={styles.halfField}>
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
          <FieldLabel label="Number of people in household" required />
          <TextInput style={styles.input} placeholder="Enter number" placeholderTextColor="#A6C1A7" keyboardType="number-pad" value={householdSize} onChangeText={updateHouseholdSize} />
          {members.map((member, index) => (
            <View key={index} style={styles.memberFields}>
              <FieldLabel label={`Household member ${index + 1}`} required />
              <TextInput style={styles.input} placeholder="Enter full name" placeholderTextColor="#A6C1A7" value={member.name} onChangeText={(name) => setMembers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name } : item))} />
              <TextInput style={styles.input} placeholder="Relationship to evacuee" placeholderTextColor="#A6C1A7" value={member.relationship} onChangeText={(relationship) => setMembers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, relationship } : item))} />
            </View>
          ))}
          <FieldLabel label="Barangay Center" required />
          <View style={styles.centerList}>
            {isCentersLoading ? <ActivityIndicator color={GREEN} /> : centers.length === 0 ? <Text style={styles.centerError}>{centerError}</Text> : centers.map((center) => (
              <TouchableOpacity key={center.id} style={[styles.centerOption, centerId === center.id && styles.centerOptionSelected]} onPress={() => setCenterId(center.id)} accessibilityRole="radio" accessibilityState={{ selected: centerId === center.id }}>
                <View style={styles.centerCopy}>
                  <Text style={styles.centerName}>{center.name}</Text>
                  <Text style={styles.centerDetails}>{center.location} · {Math.max(0, center.capacity - center.current_occupancy)} spaces</Text>
                </View>
                {centerId === center.id && <MaterialCommunityIcons name="check-circle" size={18} color={GREEN} />}
              </TouchableOpacity>
            ))}
          </View>
          {!!centerError && centers.length > 0 && <Text style={styles.centerError}>{centerError}</Text>}

          <TouchableOpacity style={[styles.submitButton, (isSubmitting || isCentersLoading || centers.length === 0) && styles.submitDisabled]} onPress={submitRegistration} activeOpacity={0.8} disabled={isSubmitting || isCentersLoading || centers.length === 0}>
            {isSubmitting ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitText}>Save</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
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
  content: { paddingBottom: 12 },
  titleBand: { backgroundColor: GREEN, paddingHorizontal: 14, paddingTop: 18, paddingBottom: 9 },
  title: { color: Colors.white, fontSize: 20, fontWeight: '800', lineHeight: 22 },
  form: { paddingHorizontal: 14, paddingBottom: 12 },
  sectionHeading: { color: '#236B27', fontSize: 18, marginTop: 12, marginBottom: 1 },
  label: { color: FIELD_GREEN, fontSize: 9, marginTop: 8, marginBottom: 4 },
  required: { color: '#D33D3D' },
  input: { height: 31, borderWidth: 1, borderColor: '#D9D9D9', borderRadius: 6, paddingHorizontal: 12, color: FIELD_GREEN, fontSize: 10, backgroundColor: Colors.white },
  inlineFields: { flexDirection: 'row', gap: 10 },
  halfField: { flex: 1 },
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
});