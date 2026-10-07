import React, { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AnimatedPressable as TouchableOpacity } from '@components/Buttons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, BorderRadius, Shadows, Spacing } from '@constants/colors';

export default function AddCenterScreen() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [barangay, setBarangay] = useState('');
  const [capacity, setCapacity] = useState('');
  const [coordinator, setCoordinator] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    const parsedCapacity = Number(capacity);
    if (!name.trim() || !address.trim() || !barangay.trim() || !Number.isInteger(parsedCapacity) || parsedCapacity < 1) {
      setError('Enter the center name, complete address, barangay, and a valid capacity.');
      return;
    }

    Alert.alert('Center information saved', `${name.trim()} is ready to be added to the evacuation center directory.`, [
      { text: 'Back to centers', onPress: () => router.replace('/(admin)/centers') },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}><MaterialCommunityIcons name="arrow-left" size={19} color={Colors.secondary} /><Text style={styles.backText}>Back to centers</Text></TouchableOpacity>
        <View style={styles.heading}><Text style={styles.eyebrow}>FIELD RESOURCES</Text><Text style={styles.title}>Add evacuation center</Text><Text style={styles.subtitle}>Enter the details for a new place that can support evacuees.</Text></View>
        <View style={styles.form}>
          <Field label="Center name" value={name} onChangeText={setName} placeholder="e.g. Barangay Covered Court" />
          <Field label="Complete address" value={address} onChangeText={setAddress} placeholder="House number, street, city" />
          <Field label="Barangay / City" value={barangay} onChangeText={setBarangay} placeholder="e.g. Barangay Poblacion, Biñan" />
          <Field label="Maximum capacity" value={capacity} onChangeText={setCapacity} placeholder="Number of evacuees" keyboardType="number-pad" />
          <Field label="Center coordinator" value={coordinator} onChangeText={setCoordinator} placeholder="Full name" />
          <Field label="Contact number" value={contactNumber} onChangeText={setContactNumber} placeholder="09XXXXXXXXX" keyboardType="phone-pad" />
          <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Available facilities or access instructions" multiline />
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={styles.submit} onPress={submit}><MaterialCommunityIcons name="content-save-outline" size={18} color={Colors.white} /><Text style={styles.submitText}>Save center information</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: 'default' | 'number-pad' | 'phone-pad'; multiline?: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={Colors.textMuted} keyboardType={keyboardType} multiline={multiline} style={[styles.input, multiline && styles.multiline]} /></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surfaceMuted },
  content: { padding: Spacing.xl, paddingBottom: 48, maxWidth: 760, width: '100%', alignSelf: 'center' },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 18 },
  backText: { color: Colors.secondary, fontSize: 12, fontWeight: '700' },
  heading: { marginBottom: 22 },
  eyebrow: { color: Colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: Colors.text, fontSize: 30, fontWeight: '800', marginTop: 5 },
  subtitle: { color: Colors.textMuted, fontSize: 14, marginTop: 6 },
  form: { backgroundColor: Colors.surface, padding: 20, borderRadius: BorderRadius.md, ...Shadows.sm },
  field: { marginBottom: 15 },
  label: { color: Colors.text, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { height: 45, borderWidth: 1, borderColor: '#D7E2EA', borderRadius: BorderRadius.sm, paddingHorizontal: 12, color: Colors.text, fontSize: 13, backgroundColor: Colors.surface },
  multiline: { height: 90, paddingTop: 12, textAlignVertical: 'top' },
  error: { color: Colors.emergency, fontSize: 12, marginBottom: 14 },
  submit: { height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: BorderRadius.sm, marginTop: 4 },
  submitText: { color: Colors.white, fontSize: 13, fontWeight: '800' },
});