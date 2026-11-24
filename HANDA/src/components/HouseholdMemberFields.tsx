import { ThemeAwareView, ThemeAwareTextInput } from '@components/ThemeAware';
import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable } from '@components/Buttons';
import type { ResidentHouseholdMember } from '@types/index';

const GREEN = '#D45B92';

export interface HouseholdMemberDraft {
  firstName: string;
  middleName: string;
  lastName: string;
  age: string;
  sex: string;
  contactNumber: string;
  relationship: string;
}

export const EMPTY_MEMBER_DRAFT: HouseholdMemberDraft = {
  firstName: '', middleName: '', lastName: '', age: '', sex: '', contactNumber: '', relationship: '',
};

export function composeMemberName(parts: { firstName?: string; middleName?: string; lastName?: string }): string {
  return [parts.firstName, parts.middleName, parts.lastName].map((part) => part?.trim()).filter(Boolean).join(' ');
}

export function memberToDraft(member?: ResidentHouseholdMember): HouseholdMemberDraft {
  if (!member) return { ...EMPTY_MEMBER_DRAFT };
  const hasParts = !!(member.firstName || member.lastName);
  const [first = '', ...rest] = member.name.trim().split(/\s+/);
  return {
    firstName: hasParts ? member.firstName ?? '' : first,
    middleName: member.middleName ?? '',
    lastName: hasParts ? member.lastName ?? '' : rest.join(' '),
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
  return {
    ...(id ? { id } : {}),
    name: composeMemberName({ firstName, middleName, lastName }),
    firstName,
    middleName,
    lastName,
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

export function HouseholdMemberFields({ draft, onChange, relationshipPlaceholder = 'Relationship to you' }: Props) {
  const set = (key: keyof HouseholdMemberDraft) => (value: string) => onChange({ ...draft, [key]: value });
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
      {input('firstName', 'First name', { autoCapitalize: 'words' })}
      {input('middleName', 'Middle name (optional)', { autoCapitalize: 'words' })}
      {input('lastName', 'Last name', { autoCapitalize: 'words' })}
      <ThemeAwareView style={styles.row}>
        <ThemeAwareView style={styles.age}>{input('age', 'Age', { keyboardType: 'numeric', maxLength: 3 })}</ThemeAwareView>
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
      {input('contactNumber', 'Contact number (optional)', { keyboardType: 'phone-pad', maxLength: 13 })}
      {input('relationship', relationshipPlaceholder, { autoCapitalize: 'words' })}
    </ThemeAwareView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  input: { minHeight: 46, borderWidth: 1.5, borderColor: '#F1C7D9', borderRadius: 12, paddingHorizontal: 14, color: '#17212B', backgroundColor: '#FFFFFF', fontSize: 14 },
  row: { flexDirection: 'row', gap: 10 },
  age: { width: 92 },
  sexRow: { flex: 1, flexDirection: 'row', gap: 8 },
  sexChip: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1.5, borderColor: '#F1C7D9', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  sexChipActive: { backgroundColor: GREEN, borderColor: GREEN },
  sexText: { color: '#17212B', fontWeight: '700', fontSize: 14 },
  sexTextActive: { color: '#FFFFFF' },
});
