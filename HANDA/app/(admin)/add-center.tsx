import React, { useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable as TouchableOpacity } from '@components/Buttons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, BorderRadius, Shadows, Spacing } from '@constants/colors';
import { createAdminCenter } from '@services/adminData';
import AppBackArrow from '@components/AppBackArrow';

export default function AddCenterScreen() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [barangay, setBarangay] = useState('');
  const [capacity, setCapacity] = useState('');
  const [coordinator, setCoordinator] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const submit = async () => {
    const parsedCapacity = Number(capacity);
    if (!name.trim() || !address.trim() || !barangay.trim() || !Number.isInteger(parsedCapacity) || parsedCapacity < 1) {
      setError('Enter the center name, complete address, barangay, and a valid capacity.');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      await createAdminCenter({
        name: name.trim(),
        location: `${address.trim()}, ${barangay.trim()}`,
        capacity: parsedCapacity,
        coordinatorName: coordinator.trim(),
        contactNumber: contactNumber.trim(),
        notes: notes.trim(),
      });
      Alert.alert('Center saved', `${name.trim()} was added.`, [
        { text: 'Back to centers', onPress: () => router.replace('/(admin)/centers') },
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The center could not be saved.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBand}><AppBackArrow /><View style={styles.titleCopy}><Text style={styles.eyebrow}>FIELD RESOURCES</Text><Text style={styles.title}>Add evacuation center</Text><Text style={styles.subtitle}>Enter the details for a new place that can support evacuees.</Text></View></View>
        <View style={styles.form}>
          <Field label="Center name" value={name} onChangeText={setName} placeholder="e.g. Barangay Covered Court" />
          <Field label="Complete address" value={address} onChangeText={setAddress} placeholder="House number, street, city" />
          <Field label="Barangay / City" value={barangay} onChangeText={setBarangay} placeholder="e.g. Barangay Poblacion, Biñan" />
          <Field label="Maximum capacity" value={capacity} onChangeText={setCapacity} placeholder="Number of evacuees" keyboardType="number-pad" />
          <Field label="Center coordinator" value={coordinator} onChangeText={setCoordinator} placeholder="Full name" />
          <Field label="Contact number" value={contactNumber} onChangeText={setContactNumber} placeholder="09XXXXXXXXX" keyboardType="phone-pad" />
          <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Available facilities or access instructions" multiline />
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={styles.submit} onPress={submit} disabled={isSaving}>{isSaving ? <ActivityIndicator color={Colors.white} /> : <><MaterialCommunityIcons name="content-save-outline" size={18} color={Colors.white} /><Text style={styles.submitText}>Save center information</Text></>}</TouchableOpacity>
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
  content: { paddingBottom: 48, maxWidth: 760, width: '100%', alignSelf: 'center' },
  titleBand: { minHeight: 90, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: '#218B25' },
  titleCopy: { flex: 1 },
  eyebrow: { color: '#DFF1DF', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: Colors.white, fontSize: 21, fontWeight: '800', marginTop: 3 },
  subtitle: { color: '#E1F1E1', fontSize: 11, marginTop: 3 },
  form: { margin: Spacing.xl, backgroundColor: Colors.surface, padding: 20, borderRadius: BorderRadius.md, ...Shadows.sm },
  field: { marginBottom: 15 },
  label: { color: Colors.text, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { height: 45, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm, paddingHorizontal: 12, color: Colors.text, fontSize: 13, backgroundColor: Colors.surface },
  multiline: { height: 90, paddingTop: 12, textAlignVertical: 'top' },
  error: { color: Colors.emergency, fontSize: 12, marginBottom: 14 },
  submit: { height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: BorderRadius.sm, marginTop: 4 },
  submitText: { color: Colors.white, fontSize: 13, fontWeight: '800' },
});