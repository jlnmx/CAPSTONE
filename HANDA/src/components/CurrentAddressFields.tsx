import { ThemeAwareView, ThemeAwareScrollView, ThemeAwarePressable, ThemeAwareTextInput } from '@components/ThemeAware';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';
import { BINAN_BARANGAYS, BINAN_CITY, type CurrentAddressParts } from '@utils/currentAddress';

type AddressPalette = {
  text: string;
  textMuted: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  accent?: string;
};

type CurrentAddressFieldsProps = {
  value: CurrentAddressParts;
  onChange: (value: CurrentAddressParts) => void;
  error?: string;
  palette?: AddressPalette;
};

const defaultPalette: AddressPalette = {
  text: Colors.text,
  textMuted: Colors.textMuted,
  surface: '#FFFFFF',
  surfaceMuted: '#FBFDFC',
  border: '#D7E2EA',
  accent: Colors.primary,
};

export function CurrentAddressFields({ value, onChange, error, palette = defaultPalette }: CurrentAddressFieldsProps) {
  const [isBarangayPickerOpen, setIsBarangayPickerOpen] = useState(false);
  const [barangaySearch, setBarangaySearch] = useState('');
  const accent = palette.accent ?? Colors.primary;
  const visibleBarangays = useMemo(() => {
    const query = barangaySearch.trim().toLowerCase();
    return BINAN_BARANGAYS.filter((barangay) => barangay.toLowerCase().includes(query));
  }, [barangaySearch]);

  const update = (field: keyof CurrentAddressParts, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  };

  return (
    <ThemeAwareView style={styles.container}>
      <Text style={[styles.sectionTitle, { color: palette.text }]}>Current Address</Text>
      <Text style={[styles.sectionHint, { color: palette.textMuted }]}>Use your Biñan City home address.</Text>
      <AddressTextField label="House No." required value={value.houseNumber} placeholder="House or unit number" maxLength={80} onChangeText={(text) => update('houseNumber', text)} palette={palette} />
      <AddressTextField label="Street" optional value={value.street} placeholder="Street name (if any)" maxLength={120} onChangeText={(text) => update('street', text)} palette={palette} />
      <AddressTextField label="Village / Subdivision / Purok" optional value={value.village} placeholder="Village, subdivision, or purok" maxLength={160} onChangeText={(text) => update('village', text)} palette={palette} />

      <ThemeAwareView style={styles.field}>
        <Text style={[styles.label, { color: palette.text }]}>Barangay<Text style={styles.required}> *</Text></Text>
        <ThemeAwarePressable
          style={[styles.selector, { borderColor: palette.border, backgroundColor: palette.surfaceMuted }]}
          onPress={() => setIsBarangayPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={value.barangay ? `Barangay, ${value.barangay}` : 'Select barangay'}
          accessibilityState={{ expanded: isBarangayPickerOpen }}
        >
          <MaterialCommunityIcons name="map-marker-outline" size={18} color={accent} />
          <Text style={[styles.selectorText, { color: value.barangay ? palette.text : palette.textMuted }]}>{value.barangay || 'Select your barangay'}</Text>
          <MaterialCommunityIcons name="chevron-down" size={20} color={palette.textMuted} />
        </ThemeAwarePressable>
      </ThemeAwareView>

      <ThemeAwareView style={styles.field}>
        <Text style={[styles.label, { color: palette.text }]}>City</Text>
        <ThemeAwareView style={[styles.cityField, { borderColor: palette.border, backgroundColor: palette.surfaceMuted }]}>
          <MaterialCommunityIcons name="city-variant-outline" size={18} color={accent} />
          <Text style={[styles.cityText, { color: palette.text }]}>{BINAN_CITY}</Text>
          <MaterialCommunityIcons name="lock-outline" size={15} color={palette.textMuted} />
        </ThemeAwareView>
      </ThemeAwareView>

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <Modal transparent visible={isBarangayPickerOpen} animationType="fade" onRequestClose={() => setIsBarangayPickerOpen(false)}>
        <ThemeAwareView style={styles.modalBackdrop}>
          <ThemeAwarePressable style={StyleSheet.absoluteFill} onPress={() => setIsBarangayPickerOpen(false)} accessibilityLabel="Close barangay selection" />
          <ThemeAwareView style={[styles.modalCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <ThemeAwareView style={styles.modalHeading}>
              <ThemeAwareView style={styles.modalHeadingCopy}>
                <Text style={[styles.modalTitle, { color: palette.text }]}>Select Barangay</Text>
                <Text style={[styles.modalSubtitle, { color: palette.textMuted }]}>Biñan City, Laguna</Text>
              </ThemeAwareView>
              <ThemeAwarePressable onPress={() => setIsBarangayPickerOpen(false)} accessibilityRole="button" accessibilityLabel="Close barangay selection" style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={21} color={palette.textMuted} />
              </ThemeAwarePressable>
            </ThemeAwareView>
            <ThemeAwareView style={[styles.searchField, { borderColor: palette.border, backgroundColor: palette.surfaceMuted }]}>
              <MaterialCommunityIcons name="magnify" size={18} color={palette.textMuted} />
              <ThemeAwareTextInput
                value={barangaySearch}
                onChangeText={setBarangaySearch}
                placeholder="Search barangays"
                placeholderTextColor={palette.textMuted}
                style={[styles.searchInput, { color: palette.text }]}
                accessibilityLabel="Search Biñan barangays"
              />
              {!!barangaySearch && <ThemeAwarePressable onPress={() => setBarangaySearch('')} accessibilityRole="button" accessibilityLabel="Clear barangay search"><MaterialCommunityIcons name="close-circle" size={17} color={palette.textMuted} /></ThemeAwarePressable>}
            </ThemeAwareView>
            <ThemeAwareScrollView style={styles.barangayList} keyboardShouldPersistTaps="handled">
              {visibleBarangays.map((barangay) => {
                const selected = barangay === value.barangay;
                return (
                  <ThemeAwarePressable
                    key={barangay}
                    style={[styles.barangayOption, { borderBottomColor: palette.border }, selected && { backgroundColor: '#FFF1F6' }]}
                    onPress={() => {
                      update('barangay', barangay);
                      setBarangaySearch('');
                      setIsBarangayPickerOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <MaterialCommunityIcons name="map-marker-outline" size={17} color={selected ? accent : palette.textMuted} />
                    <Text style={[styles.barangayOptionText, { color: selected ? accent : palette.text }]}>{barangay}</Text>
                    {selected && <MaterialCommunityIcons name="check" size={18} color={accent} />}
                  </ThemeAwarePressable>
                );
              })}
              {visibleBarangays.length === 0 && <Text style={[styles.noResults, { color: palette.textMuted }]}>No matching barangays.</Text>}
            </ThemeAwareScrollView>
          </ThemeAwareView>
        </ThemeAwareView>
      </Modal>
    </ThemeAwareView>
  );
}

function AddressTextField({ label, required, optional, value, placeholder, maxLength, onChangeText, palette }: {
  label: string;
  required?: boolean;
  optional?: boolean;
  value: string;
  placeholder: string;
  maxLength: number;
  onChangeText: (value: string) => void;
  palette: AddressPalette;
}) {
  return (
    <ThemeAwareView style={styles.field}>
      <Text style={[styles.label, { color: palette.text }]}>{label}{optional && <Text style={[styles.optional, { color: palette.textMuted }]}> (optional)</Text>}{required && <Text style={styles.required}> *</Text>}</Text>
      <ThemeAwareTextInput
        value={value}
        onChangeText={onChangeText}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor={palette.textMuted}
        autoCapitalize="words"
        style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surfaceMuted }]}
        accessibilityLabel={label}
      />
    </ThemeAwareView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700' },
  sectionHint: { fontSize: 11, marginTop: -8 },
  field: { gap: 6 },
  label: { fontSize: 11, fontWeight: '600' },
  required: { color: Colors.emergency, fontWeight: '700' },
  optional: { fontWeight: '400' },
  input: { minHeight: 48, paddingHorizontal: 13, borderWidth: 1, borderRadius: 13, fontSize: 13 },
  selector: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, borderWidth: 1, borderRadius: 13 },
  selectorText: { flex: 1, fontSize: 13 },
  cityField: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, borderWidth: 1, borderRadius: 13 },
  cityText: { flex: 1, fontSize: 13, fontWeight: '600' },
  errorText: { color: Colors.emergency, fontSize: 11 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: 'rgba(16, 24, 40, 0.55)' },
  modalCard: { width: '100%', maxWidth: 440, maxHeight: '80%', alignSelf: 'center', padding: 16, borderWidth: 1, borderRadius: 20 },
  modalHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: 13 },
  modalHeadingCopy: { flex: 1 },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  modalSubtitle: { fontSize: 11, marginTop: 3 },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  searchField: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, borderWidth: 1, borderRadius: 12, marginBottom: 8 },
  searchInput: { flex: 1, minHeight: 40, paddingVertical: 0, fontSize: 13 },
  barangayList: { flexGrow: 0 },
  barangayOption: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  barangayOptionText: { flex: 1, fontSize: 13 },
  noResults: { paddingVertical: 18, textAlign: 'center', fontSize: 12 },
});
