import React, { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import { saveLocalEvacuee } from '@services/localDatabase';
import { AnimatedPressable } from '@components/Buttons';

const GREEN = '#218B25';
const FIELD_GREEN = '#548B56';
const SEXES = ['Female', 'Male', 'Other'];

export default function RegisterEvacueeScreen() {
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [isSexOpen, setIsSexOpen] = useState(false);
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');
  const [householdSize, setHouseholdSize] = useState('');
  const [barangay, setBarangay] = useState('');

  const submitRegistration = () => {
    const parsedAge = Number(age);
    if (!firstName.trim() || !lastName.trim() || !age.trim() || !Number.isInteger(parsedAge) || parsedAge < 0 || !sex) {
      Alert.alert('Missing information', 'Complete the first name, last name, age, and sex.');
      return;
    }

    saveLocalEvacuee({
      firstName: firstName.trim(),
      middleName: middleName.trim() || undefined,
      lastName: lastName.trim(),
      age: parsedAge,
      sex,
      contactNumber: contactNumber.trim() || undefined,
      address: address.trim() || undefined,
      householdSize: householdSize.trim() ? Number(householdSize) : undefined,
      barangay: barangay.trim() || undefined,
    });
    Alert.alert('Evacuee registered', 'The registration is saved on this device and queued for synchronization.');
    setFirstName('');
    setMiddleName('');
    setLastName('');
    setAge('');
    setSex('');
    setContactNumber('');
    setAddress('');
    setHouseholdSize('');
    setBarangay('');
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

          <FieldLabel label="Contact Number" />
          <TextInput style={styles.input} placeholder="Enter contact number" placeholderTextColor="#A6C1A7" keyboardType="phone-pad" value={contactNumber} onChangeText={setContactNumber} />
          <FieldLabel label="Address" />
          <TextInput style={styles.input} placeholder="House number, street, city" placeholderTextColor="#A6C1A7" value={address} onChangeText={setAddress} />
          <View style={styles.inlineFields}>
            <View style={styles.halfField}>
              <FieldLabel label="Household Size" />
              <TextInput style={styles.input} placeholder="Members" placeholderTextColor="#A6C1A7" keyboardType="number-pad" value={householdSize} onChangeText={setHouseholdSize} />
            </View>
            <View style={styles.halfField}>
              <FieldLabel label="Barangay" />
              <TextInput style={styles.input} placeholder="Enter barangay" placeholderTextColor="#A6C1A7" value={barangay} onChangeText={setBarangay} />
            </View>
          </View>

          <TouchableOpacity style={styles.submitButton} onPress={submitRegistration} activeOpacity={0.8}>
            <Text style={styles.submitText}>Register Evacuee</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FieldLabel({ label, required = false }: { label: string; required?: boolean }) {
  return <Text style={styles.label}>{label}{required && <Text style={styles.required}> *</Text>}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  content: { paddingBottom: 12 },
  titleBand: { backgroundColor: GREEN, paddingHorizontal: 14, paddingTop: 18, paddingBottom: 9 },
  title: { color: Colors.white, fontSize: 20, fontWeight: '800', lineHeight: 22 },
  form: { paddingHorizontal: 14, paddingBottom: 12 },
  label: { color: FIELD_GREEN, fontSize: 9, marginTop: 8, marginBottom: 4 },
  required: { color: '#D33D3D' },
  input: { height: 31, borderWidth: 1, borderColor: '#D9D9D9', borderRadius: 6, paddingHorizontal: 12, color: FIELD_GREEN, fontSize: 10, backgroundColor: Colors.white },
  inlineFields: { flexDirection: 'row', gap: 10 },
  halfField: { flex: 1 },
  selectField: { height: 31, borderWidth: 1, borderColor: '#D9D9D9', borderRadius: 6, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldText: { color: FIELD_GREEN, fontSize: 10 },
  placeholder: { color: '#A6C1A7' },
  sexOptions: { position: 'absolute', top: 58, left: 0, right: 0, zIndex: 2, borderWidth: 1, borderColor: '#79B879', borderRadius: 6, backgroundColor: Colors.white },
  sexOption: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E3EDE3' },
  submitButton: { height: 38, backgroundColor: GREEN, borderRadius: 5, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  submitText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
});