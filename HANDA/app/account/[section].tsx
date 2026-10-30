import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, BorderRadius, Spacing } from '@constants/colors';
import { useAuth } from '@hooks/useAuth';
import { useResponsiveLayout } from '@hooks/useResponsiveLayout';
import { useTheme } from '@hooks/useTheme';
import { authenticatedFetch } from '@services/apiClient';
import { AuthUser } from '@types/index';
import AppBackArrow from '@components/AppBackArrow';

const NativeDateTimePicker = Platform.OS === 'web' ? null : require('@react-native-community/datetimepicker').default;

const sections = {
  'contact-number': { title: 'Contact number', detail: 'Keep your phone number current.' },
  email: { title: 'Change email', detail: 'Confirm your identity with your current password.' },
  password: { title: 'Change password', detail: 'Use at least 8 characters with uppercase, lowercase, a number, and a symbol.' },
  profile: { title: 'Personal information', detail: 'Update the details attached to your account.' },
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
        <View style={styles.header}>
          <AppBackArrow />
          <View><Text style={styles.eyebrow}>ACCOUNT SETTINGS</Text><Text style={styles.title}>{section.title}</Text></View>
        </View>
        <View style={[styles.form, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.description, { color: palette.textMuted }]}>{section.detail}</Text>
          {sectionKey === 'contact-number' && <TextInput value={mobileNumber} onChangeText={setMobileNumber} placeholder="09XX XXX XXXX" placeholderTextColor={palette.textMuted} keyboardType="phone-pad" autoComplete="tel" style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surfaceMuted }]} />}
          {sectionKey === 'email' && <>
            <TextInput value={email} onChangeText={setEmail} placeholder="name@example.com" placeholderTextColor={palette.textMuted} keyboardType="email-address" autoCapitalize="none" autoComplete="email" style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surfaceMuted }]} />
            <PasswordField label="Current password" value={currentPassword} onChangeText={setCurrentPassword} palette={palette} />
          </>}
          {sectionKey === 'password' && <>
            <PasswordField label="Current password" value={currentPassword} onChangeText={setCurrentPassword} palette={palette} />
            <PasswordField label="New password" value={newPassword} onChangeText={setNewPassword} palette={palette} />
            <PasswordField label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} palette={palette} />
          </>}
          {sectionKey === 'profile' && <>
            <TextInput value={firstName} onChangeText={setFirstName} placeholder="First name" placeholderTextColor={palette.textMuted} autoCapitalize="words" style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surfaceMuted }]} />
            <TextInput value={middleName} onChangeText={setMiddleName} placeholder="Middle name (optional)" placeholderTextColor={palette.textMuted} autoCapitalize="words" style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surfaceMuted }]} />
            <TextInput value={lastName} onChangeText={setLastName} placeholder="Last name" placeholderTextColor={palette.textMuted} autoCapitalize="words" style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surfaceMuted }]} />
            {Platform.OS === 'web' ? <TextInput value={birthday} onChangeText={setBirthday} placeholder="Select birthdate" accessibilityLabel="Select birthdate from calendar" placeholderTextColor={palette.textMuted} style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surfaceMuted }]} {...({ type: 'date', max: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}` } as object)} /> : <>
              <Pressable style={[styles.select, { borderColor: palette.border, backgroundColor: palette.surfaceMuted }]} onPress={() => setIsBirthdayPickerOpen(true)} accessibilityRole="button" accessibilityLabel="Choose birthdate">
                <Text style={[styles.selectText, { color: birthday ? palette.text : palette.textMuted }]}>{birthday || 'Birthdate'}</Text>
                <MaterialCommunityIcons name="calendar-blank-outline" size={19} color={palette.textMuted} />
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
              <Text style={[styles.selectText, { color: sex ? palette.text : palette.textMuted }]}>{sex || 'Select sex'}</Text>
              <MaterialCommunityIcons name={isSexPickerOpen ? 'chevron-up' : 'chevron-down'} size={21} color={palette.textMuted} />
            </Pressable>
            {isSexPickerOpen && <View style={[styles.sexOptions, { borderColor: palette.border, backgroundColor: palette.surface }]}>
              {['Male', 'Female'].map((option) => <Pressable key={option} onPress={() => { setSex(option); setIsSexPickerOpen(false); }} style={styles.sexOption} accessibilityRole="button"><Text style={[styles.selectText, { color: palette.text }]}>{option}</Text></Pressable>)}
            </View>}
            <TextInput value={address} onChangeText={setAddress} placeholder="Current address" placeholderTextColor={palette.textMuted} multiline textAlignVertical="top" style={[styles.input, styles.addressInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surfaceMuted }]} />
          </>}
          {!!error && <View style={styles.error}><MaterialCommunityIcons name="alert-circle-outline" size={18} color={Colors.emergency} /><Text style={styles.errorText}>{error}</Text></View>}
          <Pressable onPress={handleSave} disabled={isSaving} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, isSaving && styles.disabled]} accessibilityRole="button">
            {isSaving ? <ActivityIndicator color={Colors.white} /> : <><MaterialCommunityIcons name="content-save-outline" size={18} color={Colors.white} /><Text style={styles.saveButtonText}>Save changes</Text></>}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PasswordField({ label, value, onChangeText, palette }: { label: string; value: string; onChangeText: (value: string) => void; palette: Palette }) {
  const [visible, setVisible] = useState(false);
  return <View style={styles.passwordField}>
    <TextInput value={value} onChangeText={onChangeText} secureTextEntry={!visible} autoCapitalize="none" autoComplete={label === 'Current password' ? 'current-password' : 'new-password'} placeholder={label} placeholderTextColor={palette.textMuted} style={[styles.input, styles.passwordInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surfaceMuted }]} />
    <Pressable onPress={() => setVisible((current) => !current)} style={styles.passwordToggle} accessibilityRole="button" accessibilityLabel={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}>
      <MaterialCommunityIcons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={palette.textMuted} />
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: Spacing['3xl'] },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, backgroundColor: '#218B25', flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  eyebrow: { color: '#D8F0D8', fontSize: 10, fontWeight: '800' },
  title: { marginTop: 2, color: Colors.white, fontSize: 25, fontWeight: '800' },
  form: { width: '100%', maxWidth: 600, alignSelf: 'center', marginTop: Spacing.xl, padding: Spacing.lg, borderWidth: 1, borderRadius: BorderRadius.md },
  description: { marginBottom: Spacing.sm, fontSize: 13, lineHeight: 19 },
  input: { height: 48, marginTop: Spacing.md, paddingHorizontal: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.md, fontSize: 14 },
  passwordField: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 52 },
  passwordToggle: { position: 'absolute', right: 4, top: Spacing.md + 1, width: 42, height: 46, alignItems: 'center', justifyContent: 'center' },
  select: { minHeight: 48, marginTop: Spacing.md, paddingHorizontal: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { fontSize: 14 },
  sexOptions: { marginTop: 4, borderWidth: 1, borderRadius: BorderRadius.md, overflow: 'hidden' },
  sexOption: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: '#E8EDF1' },
  addressInput: { height: 88, minHeight: 88, paddingTop: Spacing.md, textAlignVertical: 'top' },
  error: { marginTop: Spacing.md, padding: Spacing.md, borderWidth: 1, borderColor: '#E8B4B0', borderRadius: BorderRadius.md, backgroundColor: '#FFF4F2', flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  errorText: { flex: 1, color: Colors.emergency, fontSize: 12, lineHeight: 17 },
  saveButton: { minHeight: 48, marginTop: Spacing.lg, borderRadius: BorderRadius.md, backgroundColor: '#218B25', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  saveButtonText: { color: Colors.white, fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.6 },
});