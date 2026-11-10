import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Spacing } from '@constants/colors';
import { useAuth } from '@hooks/useAuth';
import { useResponsiveLayout } from '@hooks/useResponsiveLayout';
import { useTheme } from '@hooks/useTheme';
import { authenticatedFetch } from '@services/apiClient';
import { AuthUser } from '@/types/index';
import Avatar from '@components/Avatar';
import { pickProfilePicture, removeProfilePicture, saveProfilePicture } from '@services/profilePicture';
import { AnimatedPressable } from '@components/Buttons';
import { GradientHeader, kitFonts, Reveal } from '@components/ScreenKit';

const NativeDateTimePicker = Platform.OS === 'web' ? null : require('@react-native-community/datetimepicker').default;

const sections = {
  'contact-number': { title: 'Contact number', detail: 'Keep your phone number current.' },
  email: { title: 'Change email', detail: 'Confirm your identity with your current password.' },
  password: { title: 'Change password', detail: 'Use at least 8 characters with uppercase, lowercase, a number, and a symbol.' },
  profile: { title: 'Personal information', detail: 'Update the details attached to your account.' },
} as const;

const sectionIcons = {
  'contact-number': 'phone-outline',
  email: 'email-edit-outline',
  password: 'lock-reset',
  profile: 'account-edit-outline',
} as const;

type SectionKey = keyof typeof sections;
type Palette = ReturnType<typeof useTheme>['palette'];

export default function AccountSectionScreen() {
  const router = useRouter();
  const { section: sectionParam } = useLocalSearchParams<{ section?: string }>();
  const sectionKey = typeof sectionParam === 'string' && sectionParam in sections ? sectionParam as SectionKey : null;
  const section = sectionKey ? sections[sectionKey] : null;
  const { isAuthenticated, isLoading, user, setAuthenticatedUser } = useAuth();
  const { gutter } = useResponsiveLayout();
  const { palette } = useTheme();
  const [mobileNumber, setMobileNumber] = useState(user?.mobileNumber || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [middleName, setMiddleName] = useState(user?.middleName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [birthday, setBirthday] = useState(user?.birthday || '');
  const [birthdayDate, setBirthdayDate] = useState(new Date(2000, 0, 1));
  const [isBirthdayPickerOpen, setIsBirthdayPickerOpen] = useState(false);
  const [sex, setSex] = useState(user?.sex || '');
  const [isSexPickerOpen, setIsSexPickerOpen] = useState(false);
  const [address, setAddress] = useState(user?.currentAddress || '');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPhotoBusy, setIsPhotoBusy] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/(auth)/login');
    if (!section && !isLoading) router.replace('/account');
  }, [isAuthenticated, isLoading, router, section]);

  useEffect(() => {
    setMobileNumber(user?.mobileNumber || '');
    setEmail(user?.email || '');
    setFirstName(user?.firstName || '');
    setMiddleName(user?.middleName || '');
    setLastName(user?.lastName || '');
    setBirthday(user?.birthday || '');
    const [year, month, day] = (user?.birthday || '').split('-').map(Number);
    if (year && month && day) setBirthdayDate(new Date(year, month - 1, day));
    setSex(user?.sex || '');
    setAddress(user?.currentAddress || '');
  }, [user]);

  const save = async (endpoint: string, payload: Record<string, string | null>) => {
    setIsSaving(true);
    setError('');
    try {
      const response = await authenticatedFetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { detail?: unknown; accessToken?: string } & Partial<AuthUser>;
      if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Your account could not be updated.');
      await setAuthenticatedUser(result as AuthUser, result.accessToken);
      router.replace('/account');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Your account could not be updated.');
    } finally {
      setIsSaving(false);
    }
  };

  const changePhoto = async () => {
    setError('');
    setIsPhotoBusy(true);
    try {
      const picture = await pickProfilePicture();
      if (picture && user) {
        const saved = await saveProfilePicture(picture);
        await setAuthenticatedUser({ ...user, profilePicture: saved });
      }
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : 'The profile picture could not be updated.');
    } finally {
      setIsPhotoBusy(false);
    }
  };

  const deletePhoto = async () => {
    setError('');
    setIsPhotoBusy(true);
    try {
      await removeProfilePicture();
      if (user) await setAuthenticatedUser({ ...user, profilePicture: null });
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : 'The profile picture could not be removed.');
    } finally {
      setIsPhotoBusy(false);
    }
  };

  const handleSave = () => {
    if (!sectionKey) return;
    if (sectionKey === 'contact-number') {
      const normalizedNumber = mobileNumber.replace(/[\s()-]/g, '');
      if (!/^(09\d{9}|\+639\d{9}|639\d{9})$/.test(normalizedNumber)) {
        setError('Enter a valid Philippine mobile number.');
        return;
      }
      void save('/api/v1/resident/account', { mobileNumber: normalizedNumber });
      return;
    }
    if (sectionKey === 'email') {
      const normalizedEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        setError('Enter a valid email address.');
        return;
      }
      if (!currentPassword) {
        setError('Enter your current password to change your email.');
        return;
      }
      void save('/api/v1/resident/account', { email: normalizedEmail, currentPassword });
      return;
    }
    if (sectionKey === 'password') {
      if (!currentPassword) {
        setError('Enter your current password to change it.');
        return;
      }
      if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
        setError('Use at least 8 characters with uppercase, lowercase, a number, and a symbol.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('The new passwords do not match.');
        return;
      }
      if (newPassword === currentPassword) {
        setError('Choose a password different from your current password.');
        return;
      }
      void save('/api/v1/resident/account', { currentPassword, newPassword });
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setError('Enter your first and last name.');
      return;
    }
    const birthdayValue = birthday.trim();
    if (birthdayValue) {
      const parsedBirthday = new Date(`${birthdayValue}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdayValue) || Number.isNaN(parsedBirthday.getTime()) || parsedBirthday > today || parsedBirthday.toISOString().slice(0, 10) !== birthdayValue) {
        setError('Enter a valid birthdate that is not in the future.');
        return;
      }
    }
    void save('/api/v1/auth/profile', {
      firstName: firstName.trim(),
      middleName: middleName.trim() || null,
      lastName: lastName.trim(),
      birthday: birthdayValue || null,
      sex: sex || null,
      currentAddress: address.trim(),
    });
  };

  if (isLoading || !isAuthenticated || !section) return <View style={[styles.loading, { backgroundColor: palette.background }]}><ActivityIndicator color={Colors.secondary} /></View>;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ marginHorizontal: -gutter }}>
          <GradientHeader title={section.title} subtitle="ACCOUNT SETTINGS" icon={sectionKey ? sectionIcons[sectionKey] : 'account-outline'} />
        </View>
        <Reveal index={0}>
          <View style={[styles.form, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={styles.formIntro}>
              <View style={[styles.formIcon, { backgroundColor: palette.surfaceMuted }]}>
                <MaterialCommunityIcons name={sectionKey ? sectionIcons[sectionKey] : 'account-outline'} size={23} color="#218B25" />
              </View>
              <View style={styles.formIntroCopy}>
                <Text style={[styles.formTitle, { color: palette.text }]}>{section.title}</Text>
                <Text style={[styles.description, { color: palette.textMuted }]}>{section.detail}</Text>
              </View>
            </View>
          {sectionKey === 'contact-number' && <AccountField label="Mobile number" icon="phone-outline" value={mobileNumber} onChangeText={setMobileNumber} placeholder="09XX XXX XXXX" keyboardType="phone-pad" autoComplete="tel" palette={palette} />}
          {sectionKey === 'email' && <>
            <AccountField label="New email address" icon="email-outline" value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" palette={palette} />
            <PasswordField label="Current password" value={currentPassword} onChangeText={setCurrentPassword} palette={palette} />
          </>}
          {sectionKey === 'password' && <>
            <PasswordField label="Current password" value={currentPassword} onChangeText={setCurrentPassword} palette={palette} />
            <PasswordField label="New password" value={newPassword} onChangeText={setNewPassword} palette={palette} />
            <PasswordField label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} palette={palette} />
          </>}
          {sectionKey === 'profile' && <>
            <View style={[styles.photoCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
              <Avatar uri={user?.profilePicture} name={user?.name} size={68} />
              <View style={styles.photoActions}>
                <Text style={[styles.photoTitle, { color: palette.text }]}>Profile photo</Text>
                <Text style={[styles.photoHint, { color: palette.textMuted }]}>Help others recognize your account</Text>
                <View style={styles.photoButtons}>
                  <Pressable onPress={() => void changePhoto()} disabled={isPhotoBusy} style={[styles.photoButton, { backgroundColor: palette.surface, borderColor: palette.border }]} accessibilityRole="button" accessibilityLabel={user?.profilePicture ? 'Change profile picture' : 'Add profile picture'}>
                    {isPhotoBusy ? <ActivityIndicator color={Colors.secondary} /> : <><MaterialCommunityIcons name="camera-outline" size={16} color="#218B25" /><Text style={[styles.photoButtonText, { color: palette.text }]}>{user?.profilePicture ? 'Change' : 'Add photo'}</Text></>}
                  </Pressable>
                  {!!user?.profilePicture && <Pressable onPress={() => void deletePhoto()} disabled={isPhotoBusy} style={styles.deletePhotoButton} accessibilityRole="button" accessibilityLabel="Delete profile picture"><Text style={styles.photoDeleteText}>Remove</Text></Pressable>}
                </View>
              </View>
            </View>
            <View style={styles.formSectionHeading}>
              <Text style={[styles.formSectionTitle, { color: palette.text }]}>Basic details</Text>
              <Text style={[styles.formSectionHint, { color: palette.textMuted }]}>Fields marked with * are required</Text>
            </View>
            <AccountField label="First name" icon="account-outline" value={firstName} onChangeText={setFirstName} placeholder="First name" autoCapitalize="words" palette={palette} required />
            <AccountField label="Middle name" icon="account-outline" value={middleName} onChangeText={setMiddleName} placeholder="Optional" autoCapitalize="words" palette={palette} />
            <AccountField label="Last name" icon="account-outline" value={lastName} onChangeText={setLastName} placeholder="Last name" autoCapitalize="words" palette={palette} required />
            {Platform.OS === 'web' ? <AccountField label="Birthdate" icon="calendar-blank-outline" value={birthday} onChangeText={setBirthday} placeholder="Select birthdate" accessibilityLabel="Select birthdate from calendar" palette={palette} {...({ type: 'date', max: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}` } as object)} /> : <>
              <Pressable style={[styles.select, { borderColor: palette.border, backgroundColor: palette.surfaceMuted }]} onPress={() => setIsBirthdayPickerOpen(true)} accessibilityRole="button" accessibilityLabel="Choose birthdate">
                <View style={styles.selectLeading}><MaterialCommunityIcons name="calendar-blank-outline" size={18} color="#218B25" /><Text style={[styles.fieldLabel, { color: palette.text }]}>Birthdate</Text></View>
                <Text style={[styles.selectText, { color: birthday ? palette.text : palette.textMuted }]}>{birthday || 'Birthdate'}</Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color={palette.textMuted} />
              </Pressable>
              {NativeDateTimePicker && isBirthdayPickerOpen && <NativeDateTimePicker value={birthdayDate} mode="date" display={Platform.OS === 'android' ? 'calendar' : 'default'} maximumDate={new Date()} onChange={(_event: unknown, selectedDate?: Date) => {
                setIsBirthdayPickerOpen(false);
                if (selectedDate) {
                  setBirthdayDate(selectedDate);
                  setBirthday(`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`);
                }
              }} />}
            </>}
            <Pressable style={[styles.select, { borderColor: palette.border, backgroundColor: palette.surfaceMuted }]} onPress={() => setIsSexPickerOpen((open) => !open)} accessibilityRole="button" accessibilityLabel="Choose sex">
              <View style={styles.selectLeading}><MaterialCommunityIcons name="gender-male-female" size={18} color="#218B25" /><Text style={[styles.fieldLabel, { color: palette.text }]}>Sex</Text></View>
              <Text style={[styles.selectText, { color: sex ? palette.text : palette.textMuted }]}>{sex || 'Select'}</Text>
              <MaterialCommunityIcons name={isSexPickerOpen ? 'chevron-up' : 'chevron-down'} size={21} color={palette.textMuted} />
            </Pressable>
            {isSexPickerOpen && <View style={[styles.sexOptions, { borderColor: palette.border, backgroundColor: palette.surface }]}>
              {['Male', 'Female'].map((option) => <Pressable key={option} onPress={() => { setSex(option); setIsSexPickerOpen(false); }} style={styles.sexOption} accessibilityRole="button"><Text style={[styles.selectText, { color: palette.text }]}>{option}</Text></Pressable>)}
            </View>}
            <AccountField label="Current address" icon="map-marker-outline" value={address} onChangeText={setAddress} placeholder="Enter your current address" multiline textAlignVertical="top" palette={palette} />
          </>}
            {!!error && <View style={styles.error}><MaterialCommunityIcons name="alert-circle-outline" size={18} color={Colors.emergency} /><Text style={styles.errorText}>{error}</Text></View>}
            <AnimatedPressable onPress={handleSave} disabled={isSaving} style={[styles.saveButton, isSaving && styles.disabled]} accessibilityRole="button">
              {isSaving ? <ActivityIndicator color={Colors.white} /> : <><Text style={styles.saveButtonText}>Save changes</Text><MaterialCommunityIcons name="arrow-right" size={19} color={Colors.white} /></>}
            </AnimatedPressable>
          </View>
        </Reveal>
      </ScrollView>
    </SafeAreaView>
  );
}

function PasswordField({ label, value, onChangeText, palette }: { label: string; value: string; onChangeText: (value: string) => void; palette: Palette }) {
  const [visible, setVisible] = useState(false);
  return <View style={styles.passwordField}>
    <Text style={[styles.fieldLabelStandalone, { color: palette.text }]}>{label}</Text>
    <View style={[styles.inputWrap, { borderColor: palette.border, backgroundColor: palette.surfaceMuted }]}>
      <MaterialCommunityIcons name="lock-outline" size={19} color="#218B25" style={styles.inputIcon} />
      <TextInput value={value} onChangeText={onChangeText} secureTextEntry={!visible} autoCapitalize="none" autoComplete={label === 'Current password' ? 'current-password' : 'new-password'} placeholder={label} placeholderTextColor={palette.textMuted} style={[styles.input, styles.passwordInput, { color: palette.text }]} />
      <Pressable onPress={() => setVisible((current) => !current)} style={styles.passwordToggle} accessibilityRole="button" accessibilityLabel={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}>
        <MaterialCommunityIcons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={palette.textMuted} />
      </Pressable>
    </View>
  </View>;
}

function AccountField({ label, icon, palette, required, style, ...input }: { label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; palette: Palette; required?: boolean } & TextInputProps) {
  return <View style={styles.field}>
    <Text style={[styles.fieldLabelStandalone, { color: palette.text }]}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text>
    <View style={[styles.inputWrap, { borderColor: palette.border, backgroundColor: palette.surfaceMuted }, input.multiline && styles.multilineWrap]}>
      <MaterialCommunityIcons name={icon} size={19} color="#218B25" style={[styles.inputIcon, input.multiline && styles.multilineIcon]} />
      <TextInput {...input} placeholderTextColor={palette.textMuted} selectionColor="#218B25" style={[styles.input, input.multiline && styles.addressInput, style, { color: palette.text }]} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: Spacing['3xl'] },
  form: { width: '100%', maxWidth: 640, alignSelf: 'center', marginTop: 18, padding: 18, borderWidth: 1, borderRadius: 22, gap: 15 },
  formIntro: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingBottom: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DDE6DE' },
  formIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  formIntroCopy: { flex: 1, minWidth: 0 },
  formTitle: { fontFamily: kitFonts.heading, fontSize: 17 },
  description: { marginTop: 4, fontFamily: kitFonts.medium, fontSize: 12, lineHeight: 18 },
  field: { gap: 7 },
  fieldLabelStandalone: { fontFamily: kitFonts.semibold, fontSize: 12 },
  required: { color: '#D62828', fontFamily: kitFonts.bold },
  inputWrap: { minHeight: 52, borderWidth: 1, borderRadius: 15, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  inputIcon: { marginLeft: 15 },
  input: { flex: 1, minWidth: 0, minHeight: 50, paddingHorizontal: 12, paddingVertical: 12, fontFamily: kitFonts.medium, fontSize: 14 },
  passwordField: { gap: 7 },
  passwordInput: { paddingRight: 5 },
  passwordToggle: { width: 48, height: 50, alignItems: 'center', justifyContent: 'center' },
  select: { minHeight: 54, paddingHorizontal: 14, borderWidth: 1, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectLeading: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  fieldLabel: { fontFamily: kitFonts.semibold, fontSize: 12 },
  selectText: { fontFamily: kitFonts.medium, fontSize: 13 },
  sexOptions: { marginTop: -10, borderWidth: 1, borderRadius: 13, overflow: 'hidden' },
  sexOption: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8EDF1' },
  multilineWrap: { minHeight: 104, alignItems: 'flex-start' },
  multilineIcon: { marginTop: 16 },
  addressInput: { minHeight: 102, textAlignVertical: 'top' },
  formSectionHeading: { marginTop: 3, marginBottom: -3, gap: 3 },
  formSectionTitle: { fontFamily: kitFonts.heading, fontSize: 14 },
  formSectionHint: { fontFamily: kitFonts.medium, fontSize: 11 },
  photoCard: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 13, borderRadius: 17, borderWidth: 1 },
  photoActions: { flex: 1, gap: 5 },
  photoTitle: { fontFamily: kitFonts.semibold, fontSize: 13 },
  photoHint: { fontFamily: kitFonts.medium, fontSize: 11 },
  photoButtons: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  photoButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 11, borderRadius: 11, borderWidth: 1 },
  photoButtonText: { fontFamily: kitFonts.semibold, fontSize: 12 },
  deletePhotoButton: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 3 },
  photoDeleteText: { color: Colors.emergency, fontFamily: kitFonts.semibold, fontSize: 12 },
  error: { padding: 13, borderWidth: 1, borderColor: '#E8B4B0', borderRadius: 14, backgroundColor: '#FFF4F2', flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  errorText: { flex: 1, color: Colors.emergency, fontFamily: kitFonts.medium, fontSize: 12, lineHeight: 18 },
  saveButton: { minHeight: 52, marginTop: 3, borderRadius: 15, backgroundColor: '#218B25', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  saveButtonText: { color: Colors.white, fontFamily: kitFonts.bold, fontSize: 14 },
  disabled: { opacity: 0.6 },
});