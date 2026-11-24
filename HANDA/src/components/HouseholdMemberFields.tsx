import { ThemeAwareView, ThemeAwareTextInput } from '@components/ThemeAware';
import React from 'react';
import { Modal, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable } from '@components/Buttons';
import type { ResidentHouseholdMember } from '@/types/index';
import { pickProfilePicture } from '@services/profilePicture';
import { Image } from 'react-native';

const GREEN = '#D45B92';

export interface HouseholdMemberDraft {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  profilePicture: string;
  age: string;
  sex: string;
  contactNumber: string;
  relationship: string;
}

export const EMPTY_MEMBER_DRAFT: HouseholdMemberDraft = {
  firstName: '', middleName: '', lastName: '', suffix: '', profilePicture: '', age: '', sex: '', contactNumber: '', relationship: '',
};

export function composeMemberName(parts: { firstName?: string; middleName?: string; lastName?: string; suffix?: string }): string {
  return [parts.firstName, parts.middleName, parts.lastName, parts.suffix].map((part) => part?.trim()).filter(Boolean).join(' ');
}

export function memberToDraft(member?: ResidentHouseholdMember): HouseholdMemberDraft {
  if (!member) return { ...EMPTY_MEMBER_DRAFT };
  const hasParts = !!(member.firstName || member.lastName);
  const [first = '', ...rest] = member.name.trim().split(/\s+/);
  const suffix = member.suffix ?? '';
  if (!hasParts && suffix && rest.at(-1)?.toLocaleLowerCase() === suffix.toLocaleLowerCase()) {
    rest.pop();
  }
  return {
    firstName: hasParts ? member.firstName ?? '' : first,
    middleName: member.middleName ?? '',
    lastName: hasParts ? member.lastName ?? '' : rest.join(' '),
    suffix,
    profilePicture: member.profilePicture ?? '',
    age: member.age == null ? '' : String(member.age),
    sex: member.sex ?? '',
    contactNumber: member.contactNumber ?? '',
    relationship: member.relationship ?? '',
  };
}

export function draftToMember(draft: HouseholdMemberDraft, id?: string): ResidentHouseholdMember {
  const firstName = draft.firstName.trim();
  const middleName = draft.middleName.trim();
  const lastName = draft.lastName.trim();
  const suffix = draft.suffix.trim();
  return {
    ...(id ? { id } : {}),
    name: composeMemberName({ firstName, middleName, lastName, suffix }),
    firstName,
    middleName,
    lastName,
    suffix,
    profilePicture: draft.profilePicture || undefined,
    age: draft.age.trim() ? Number(draft.age) : null,
    sex: draft.sex || undefined,
    contactNumber: draft.contactNumber.trim(),
    relationship: draft.relationship.trim(),
  };
}

// Returns an error message, or '' when the draft is complete.
export function validateMemberDraft(draft: HouseholdMemberDraft): string {
  if (!draft.firstName.trim() || !draft.lastName.trim()) return 'Enter the first and last name.';
  const age = Number(draft.age);
  if (!draft.age.trim() || !Number.isInteger(age) || age < 0 || age > 150) return 'Enter a valid age (0-150).';
  if (!draft.sex) return 'Select the sex.';
  if (draft.contactNumber.trim() && !/^(09\d{9}|\+639\d{9}|639\d{9})$/.test(draft.contactNumber.trim())) return 'Enter a valid PH mobile number or leave it blank.';
  if (!draft.relationship.trim()) return 'Enter the relationship.';
  return '';
}

export function isMemberComplete(member: ResidentHouseholdMember): boolean {
  return !!member.name?.trim() && !!member.relationship?.trim();
}

export function memberSummary(member: ResidentHouseholdMember): string {
  return [member.relationship, member.age != null ? `${member.age} yrs` : '', member.sex].filter(Boolean).join(' • ');
}

interface Props {
  draft: HouseholdMemberDraft;
  onChange: (draft: HouseholdMemberDraft) => void;
  relationshipPlaceholder?: string;
}

function fieldLabel(label: string, required = false) {
  return (
    <Text style={styles.fieldLabel}>
      {label}{required ? <Text style={styles.required}> *</Text> : null}
    </Text>
  );
}

export function HouseholdMemberFields({ draft, onChange, relationshipPlaceholder = 'Relationship to you' }: Props) {
  const [relationshipPickerOpen, setRelationshipPickerOpen] = React.useState(false);
  const [showCustomRelationship, setShowCustomRelationship] = React.useState(false);
  const [photoPickerOpen, setPhotoPickerOpen] = React.useState(false);
  const [photoError, setPhotoError] = React.useState('');
  const set = (key: keyof HouseholdMemberDraft) => (value: string) => onChange({ ...draft, [key]: value });
  const choosePhoto = async (source: 'library' | 'camera') => {
    setPhotoPickerOpen(false);
    setPhotoError('');
    try {
      const picture = await pickProfilePicture(source);
      if (picture) onChange({ ...draft, profilePicture: picture });
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'The photo could not be selected.');
    }
  };
  const relationshipOptions = ['Spouse', 'Son', 'Daughter', 'Parent', 'Sibling', 'Grandparent', 'Grandchild', 'Relative', 'Guardian', 'Housemate', 'Other'];
  const hasCustomRelationship = !!draft.relationship && !relationshipOptions.includes(draft.relationship);
  const showRelationshipTextField = showCustomRelationship || hasCustomRelationship;
  const input = (key: keyof HouseholdMemberDraft, placeholder: string, extra: React.ComponentProps<typeof TextInput> = {}) => (
    <ThemeAwareTextInput
      style={styles.input}
      value={draft[key]}
      onChangeText={set(key)}
      placeholder={placeholder}
      placeholderTextColor="#79967A"
      selectionColor={GREEN}
      {...extra}
    />
  );

  return (
    <ThemeAwareView style={styles.wrap}>
      <ThemeAwareView style={styles.photoSection}>
        <ThemeAwareView style={styles.photoPreview}>
          {draft.profilePicture
            ? <Image source={{ uri: draft.profilePicture }} style={styles.photoImage} />
            : <Text style={styles.photoInitial}>{draft.firstName?.trim().charAt(0).toUpperCase() || '?'}</Text>}
        </ThemeAwareView>
        <ThemeAwareView style={styles.photoActions}>
          <Text style={styles.sectionTitle}>Profile photo</Text>
          <Text style={styles.photoHint}>Optional · take or upload one photo</Text>
          <AnimatedPressable style={styles.photoButton} onPress={() => setPhotoPickerOpen(true)} accessibilityRole="button" accessibilityLabel="Add household member profile photo">
            <Text style={styles.photoButtonText}>{draft.profilePicture ? 'Change photo' : 'Add photo'}</Text>
          </AnimatedPressable>
          {!!draft.profilePicture && (
            <AnimatedPressable style={styles.removePhotoButton} onPress={() => onChange({ ...draft, profilePicture: '' })} accessibilityRole="button" accessibilityLabel="Remove household member profile photo">
              <Text style={styles.removePhotoText}>Remove</Text>
            </AnimatedPressable>
          )}
          {!!photoError && <Text style={styles.photoError}>{photoError}</Text>}
        </ThemeAwareView>
      </ThemeAwareView>

      <ThemeAwareView style={styles.section}>
        <Text style={styles.sectionTitle}>Personal name</Text>
        <ThemeAwareView style={styles.nameRow}>
          <ThemeAwareView style={styles.nameField}>{fieldLabel('First name', true)}{input('firstName', 'Enter first name', { autoCapitalize: 'words', accessibilityLabel: 'First name' })}</ThemeAwareView>
          <ThemeAwareView style={styles.nameField}>{fieldLabel('Middle name')}<ThemeAwareTextInput style={styles.input} value={draft.middleName} onChangeText={set('middleName')} placeholder="Enter middle name" placeholderTextColor="#79967A" autoCapitalize="words" accessibilityLabel="Middle name" /></ThemeAwareView>
        </ThemeAwareView>
        <ThemeAwareView style={styles.nameRow}>
          <ThemeAwareView style={[styles.nameField, styles.lastNameField]}>{fieldLabel('Last name', true)}{input('lastName', 'Enter last name', { autoCapitalize: 'words', accessibilityLabel: 'Last name' })}</ThemeAwareView>
          <ThemeAwareView style={styles.suffixField}>{fieldLabel('Suffix')}<ThemeAwareTextInput style={styles.input} value={draft.suffix} onChangeText={set('suffix')} placeholder="Jr., III" placeholderTextColor="#79967A" autoCapitalize="words" maxLength={30} accessibilityLabel="Name suffix" /></ThemeAwareView>
        </ThemeAwareView>
      </ThemeAwareView>

      <ThemeAwareView style={styles.section}>
        <Text style={styles.sectionTitle}>Basic details</Text>
        <ThemeAwareView style={styles.basicRow}>
          <ThemeAwareView style={styles.ageField}>{fieldLabel('Age', true)}{input('age', 'Age', { keyboardType: 'numeric', maxLength: 3, accessibilityLabel: 'Age' })}</ThemeAwareView>
          <ThemeAwareView style={styles.sexField}>
            {fieldLabel('Sex', true)}
            <ThemeAwareView style={styles.sexRow}>
              {['Male', 'Female'].map((option) => (
                <AnimatedPressable
                  key={option}
                  style={[styles.sexChip, draft.sex === option && styles.sexChipActive]}
                  onPress={() => onChange({ ...draft, sex: option })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: draft.sex === option }}
                >
                  <Text style={[styles.sexText, draft.sex === option && styles.sexTextActive]}>{option}</Text>
                </AnimatedPressable>
              ))}
            </ThemeAwareView>
          </ThemeAwareView>
        </ThemeAwareView>
      </ThemeAwareView>

      <ThemeAwareView style={styles.section}>
        <Text style={styles.sectionTitle}>Contact and relationship</Text>
        {fieldLabel('Contact number')}
        {input('contactNumber', '09XX XXX XXXX', { keyboardType: 'phone-pad', maxLength: 13, accessibilityLabel: 'Contact number' })}
        {fieldLabel('Relationship', true)}
        <AnimatedPressable
          style={[styles.relationshipSelect, draft.relationship ? styles.relationshipSelected : null]}
          onPress={() => setRelationshipPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={draft.relationship ? `Relationship: ${draft.relationship}` : relationshipPlaceholder}
        >
          <ThemeAwareView style={styles.relationshipCopy}>
            <Text style={draft.relationship ? styles.relationshipValue : styles.relationshipPlaceholder}>{draft.relationship || relationshipPlaceholder}</Text>
          </ThemeAwareView>
          <Text style={styles.selectArrow}>⌄</Text>
        </AnimatedPressable>
        {showRelationshipTextField && (
          <ThemeAwareView style={styles.customRelationship}>
            {fieldLabel('Specify relationship', true)}
            {input('relationship', 'Enter relationship', { autoCapitalize: 'words', accessibilityLabel: 'Custom relationship' })}
          </ThemeAwareView>
        )}
      </ThemeAwareView>
      <Modal transparent visible={relationshipPickerOpen} animationType="fade" onRequestClose={() => setRelationshipPickerOpen(false)}>
        <ThemeAwareView style={styles.modalBackdrop}>
          <ThemeAwareView style={styles.relationshipDialog}>
            <Text style={styles.relationshipTitle}>Choose relationship</Text>
            <Text style={styles.relationshipSubtitle}>How is this person related to you?</Text>
            <ScrollView style={styles.relationshipOptions} showsVerticalScrollIndicator={false}>
              {relationshipOptions.map((option) => (
                <AnimatedPressable
                  key={option}
                  style={[styles.relationshipOption, draft.relationship === option && styles.relationshipOptionActive]}
                  onPress={() => {
                    if (option === 'Other') {
                      onChange({ ...draft, relationship: '' });
                      setShowCustomRelationship(true);
                    } else {
                      onChange({ ...draft, relationship: option });
                      setShowCustomRelationship(false);
                    }
                    setRelationshipPickerOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: draft.relationship === option }}
                >
                  <Text style={[styles.relationshipOptionText, draft.relationship === option && styles.relationshipOptionTextActive]}>{option}</Text>
                </AnimatedPressable>
              ))}
            </ScrollView>
            <AnimatedPressable style={styles.relationshipCancel} onPress={() => setRelationshipPickerOpen(false)} accessibilityRole="button">
              <Text style={styles.relationshipCancelText}>Cancel</Text>
            </AnimatedPressable>
          </ThemeAwareView>
        </ThemeAwareView>
      </Modal>
      <Modal transparent visible={photoPickerOpen} animationType="fade" onRequestClose={() => setPhotoPickerOpen(false)}>
        <ThemeAwareView style={styles.modalBackdrop}>
          <ThemeAwareView style={styles.photoDialog}>
            <Text style={styles.relationshipTitle}>Add profile photo</Text>
            <Text style={styles.relationshipSubtitle}>Choose a photo source.</Text>
            <AnimatedPressable style={styles.photoOption} onPress={() => void choosePhoto('camera')} accessibilityRole="button">
              <Text style={styles.photoOptionText}>Take photo</Text>
            </AnimatedPressable>
            <AnimatedPressable style={styles.photoOption} onPress={() => void choosePhoto('library')} accessibilityRole="button">
              <Text style={styles.photoOptionText}>Upload photo</Text>
            </AnimatedPressable>
            <AnimatedPressable style={styles.relationshipCancel} onPress={() => setPhotoPickerOpen(false)} accessibilityRole="button">
              <Text style={styles.relationshipCancelText}>Cancel</Text>
            </AnimatedPressable>
          </ThemeAwareView>
        </ThemeAwareView>
      </Modal>
    </ThemeAwareView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  photoSection: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderColor: '#E9CFE0', borderRadius: 16, backgroundColor: '#FFFFFF' },
  photoPreview: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 36, borderWidth: 2, borderColor: '#F1C7D9', backgroundColor: '#FFF1F6' },
  photoImage: { width: '100%', height: '100%' },
  photoInitial: { color: '#A84F7D', fontFamily: 'Sora_700Bold', fontSize: 24 },
  photoActions: { flex: 1 },
  photoHint: { color: '#667085', fontFamily: 'InstrumentSans_500Medium', fontSize: 11, marginTop: 3 },
  photoButton: { minHeight: 38, alignItems: 'center', justifyContent: 'center', marginTop: 8, borderRadius: 10, backgroundColor: '#FFF1F6', borderWidth: 1, borderColor: '#F1C7D9' },
  photoButtonText: { color: '#A84F7D', fontFamily: 'InstrumentSans_700Bold', fontSize: 12 },
  removePhotoButton: { alignSelf: 'flex-start', marginTop: 6 },
  removePhotoText: { color: '#B42318', fontFamily: 'InstrumentSans_600SemiBold', fontSize: 11 },
  photoError: { color: '#B42318', fontFamily: 'InstrumentSans_500Medium', fontSize: 10, marginTop: 5 },
  section: { gap: 8, padding: 12, borderWidth: 1, borderColor: '#E9CFE0', borderRadius: 16, backgroundColor: '#FFFFFF' },
  sectionTitle: { color: '#17212B', fontFamily: 'Sora_700Bold', fontSize: 12, marginBottom: 2 },
  fieldLabel: { color: '#52605A', fontFamily: 'InstrumentSans_600SemiBold', fontSize: 11, marginBottom: 6 },
  required: { color: '#C43D73', fontFamily: 'InstrumentSans_700Bold' },
  input: { minHeight: 46, borderWidth: 1.5, borderColor: '#F1C7D9', borderRadius: 12, paddingHorizontal: 12, color: '#17212B', backgroundColor: '#FFFFFF', fontSize: 13 },
  nameRow: { flexDirection: 'row', gap: 8 },
  nameField: { flex: 1 },
  lastNameField: { flex: 1.35 },
  suffixField: { flex: 0.65 },
  basicRow: { flexDirection: 'row', gap: 8 },
  ageField: { width: 78 },
  sexField: { flex: 1 },
  sexRow: { flex: 1, flexDirection: 'row', gap: 8 },
  sexChip: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1.5, borderColor: '#F1C7D9', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  sexChipActive: { backgroundColor: GREEN, borderColor: GREEN },
  sexText: { color: '#17212B', fontWeight: '700', fontSize: 14 },
  sexTextActive: { color: '#FFFFFF' },
  relationshipSelect: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: '#F1C7D9', borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#FFFFFF' },
  relationshipSelected: { borderColor: '#D45B92', backgroundColor: '#FFF8FB' },
  relationshipCopy: { flex: 1 },
  relationshipValue: { color: '#17212B', fontFamily: 'InstrumentSans_600SemiBold', fontSize: 13 },
  relationshipPlaceholder: { color: '#79967A', fontFamily: 'InstrumentSans_500Medium', fontSize: 13 },
  selectArrow: { color: '#A84F7D', fontSize: 18, marginTop: -4 },
  customRelationship: { marginTop: 10 },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: 'rgba(13,28,17,0.48)' },
  relationshipDialog: { width: '100%', maxWidth: 420, maxHeight: '78%', padding: 18, borderRadius: 20, backgroundColor: '#FFFFFF' },
  relationshipTitle: { color: '#17212B', fontFamily: 'Sora_700Bold', fontSize: 17 },
  relationshipSubtitle: { color: '#667085', fontFamily: 'InstrumentSans_500Medium', fontSize: 12, marginTop: 4, marginBottom: 12 },
  relationshipOptions: { maxHeight: 330 },
  relationshipOption: { minHeight: 46, justifyContent: 'center', marginBottom: 6, paddingHorizontal: 13, borderWidth: 1, borderColor: '#E8DDE5', borderRadius: 12, backgroundColor: '#FFFFFF' },
  relationshipOptionActive: { borderColor: '#D45B92', backgroundColor: '#FFF1F6' },
  relationshipOptionText: { color: '#52605A', fontFamily: 'InstrumentSans_600SemiBold', fontSize: 13 },
  relationshipOptionTextActive: { color: '#A84F7D' },
  relationshipCancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: '#E8DDE5' },
  relationshipCancelText: { color: '#667085', fontFamily: 'InstrumentSans_700Bold', fontSize: 12 },
  photoDialog: { width: '100%', maxWidth: 420, padding: 18, borderRadius: 20, backgroundColor: '#FFFFFF' },
  photoOption: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8, borderWidth: 1, borderColor: '#F1C7D9', borderRadius: 12, backgroundColor: '#FFF8FB' },
  photoOptionText: { color: '#A84F7D', fontFamily: 'InstrumentSans_700Bold', fontSize: 13 },
});
