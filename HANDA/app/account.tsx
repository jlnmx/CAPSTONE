import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, BorderRadius, Spacing } from '@constants/colors';
import { useAuth } from '@hooks/useAuth';
import { useResponsiveLayout } from '@hooks/useResponsiveLayout';
import { useTheme } from '@hooks/useTheme';
import { authenticatedFetch } from '@services/apiClient';
import { AuthUser } from '@types/index';
import AppBackArrow from '@components/AppBackArrow';

export default function AccountScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, setAuthenticatedUser } = useAuth();
  const { gutter } = useResponsiveLayout();
  const [contactNumber, setContactNumber] = useState(user?.mobileNumber || '');
  const [email, setEmail] = useState(user?.email || '');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [passwordCurrentPassword, setPasswordCurrentPassword] = useState('');
  const [isEmailCurrentPasswordVisible, setIsEmailCurrentPasswordVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isCurrentPasswordVisible, setIsCurrentPasswordVisible] = useState(false);
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profileError, setProfileError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const { palette } = useTheme();

  useEffect(() => { if (!isLoading && !isAuthenticated) router.replace('/(auth)/login'); }, [isAuthenticated, isLoading, router]);
  if (isLoading || !isAuthenticated) return <View style={[styles.loading, { backgroundColor: palette.background }]}><ActivityIndicator color={Colors.secondary} /></View>;

  const updateAccount = async (payload: Record<string, string>, message: string) => {
    setIsSavingAccount(true);
    setAccountError('');
    try {
      const response = await authenticatedFetch('/api/v1/resident/account', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json() as { detail?: unknown; accessToken?: string } & Partial<AuthUser>;
      if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Your account could not be updated.');
      await setAuthenticatedUser(result as AuthUser, result.accessToken);
      if (result.email) setEmail(result.email);
      if (result.mobileNumber) setContactNumber(result.mobileNumber);
      if ('email' in payload) setEmailCurrentPassword('');
      if ('newPassword' in payload) {
        setPasswordCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
      setSuccessMessage(message);
      setIsSuccessModalOpen(true);
      return true;
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'Your account could not be updated.');
      return false;
    } finally {
      setIsSavingAccount(false);
    }
  };

  const saveContactNumber = () => {
    if (!/^(09\d{9}|\+639\d{9}|639\d{9})$/.test(contactNumber.replace(/[\s()-]/g, ''))) {
      setAccountError('Enter a valid Philippine mobile number.');
      return;
    }
    void updateAccount({ mobileNumber: contactNumber.replace(/[\s()-]/g, '') }, 'Your contact number has been updated.');
  };
  const saveEmail = () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setAccountError('Enter a valid email address.');
      return;
    }
    if (!emailCurrentPassword) {
      setAccountError('Enter your current password to change your email.');
      return;
    }
    void updateAccount({ email: normalizedEmail, currentPassword: emailCurrentPassword }, 'Your email address has been updated. Use it the next time you sign in.');
  };
  const savePassword = () => {
    if (!passwordCurrentPassword) {
      setAccountError('Enter your current password to change it.');
      return;
    }
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      setAccountError('Use at least 8 characters with uppercase, lowercase, a number, and a symbol.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setAccountError('The new passwords do not match.');
      return;
    }
    if (newPassword === passwordCurrentPassword) {
      setAccountError('Choose a password different from your current password.');
      return;
    }
    void updateAccount({ currentPassword: passwordCurrentPassword, newPassword }, 'Your password has been updated. Use it the next time you sign in.');
  };
  const editInformation = () => {
    const nameParts = user?.name.split(/\s+/) ?? [];
    setFirstName(user?.firstName || nameParts[0] || '');
    setMiddleName(user?.middleName || '');
    setLastName(user?.lastName || nameParts.slice(1).join(' '));
    setProfileError('');
    setIsProfileEditorOpen(true);
  };

  const saveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setProfileError('Enter your first and last name.');
      return;
    }
    setIsSavingProfile(true);
    setProfileError('');
    try {
      const response = await authenticatedFetch('/api/v1/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: firstName.trim(), middleName: middleName.trim() || null, lastName: lastName.trim() }),
      });
      const result = await response.json() as { detail?: unknown } & Partial<AuthUser>;
      if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Your profile could not be updated.');
      await setAuthenticatedUser(result as AuthUser);
      setIsProfileEditorOpen(false);
      Alert.alert('Profile updated', 'Your personal information has been saved.');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Your profile could not be updated.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}><AppBackArrow /><View><Text style={styles.eyebrow}>YOUR PROFILE</Text><Text style={styles.title}>Account</Text></View></View>
        <View style={[styles.profileCard, { backgroundColor: palette.surface, borderColor: palette.border }]}><View style={styles.avatar}><MaterialCommunityIcons name="account-outline" size={38} color={Colors.secondary} /></View><View style={styles.profileCopy}><Text style={[styles.name, { color: palette.text }]}>{user?.name || 'HANDA User'}</Text><Text style={[styles.email, { color: palette.textMuted }]}>{user?.email || 'No email available'}</Text><View style={styles.rolePill}><Text style={styles.roleText}>{user?.role || 'resident'}</Text></View></View></View>
        {!!accountError && <View style={styles.accountError}><MaterialCommunityIcons name="alert-circle-outline" size={18} color={Colors.emergency} /><Text style={styles.accountErrorText}>{accountError}</Text></View>}
        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.sectionHeading}><View style={styles.sectionIcon}><MaterialCommunityIcons name="phone-outline" size={20} color={Colors.success} /></View><View><Text style={[styles.sectionTitle, { color: palette.text }]}>Contact number</Text><Text style={[styles.sectionDetail, { color: palette.textMuted }]}>Keep your account contact details current</Text></View></View>
          <TextInput value={contactNumber} onChangeText={(value) => { setContactNumber(value); setAccountError(''); }} placeholder="09XX XXX XXXX" placeholderTextColor={palette.textMuted} keyboardType="phone-pad" style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surfaceMuted }]} />
          <Pressable onPress={saveContactNumber} disabled={isSavingAccount} style={({ pressed }) => [styles.primaryButton, (pressed || isSavingAccount) && styles.pressed]}>{isSavingAccount ? <ActivityIndicator color={Colors.white} /> : <><MaterialCommunityIcons name="content-save-outline" size={18} color={Colors.white} /><Text style={styles.primaryButtonText}>Save contact number</Text></>}</Pressable>
        </View>
        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.sectionHeading}><View style={styles.sectionIcon}><MaterialCommunityIcons name="email-edit-outline" size={20} color={Colors.secondary} /></View><View><Text style={[styles.sectionTitle, { color: palette.text }]}>Change email</Text><Text style={[styles.sectionDetail, { color: palette.textMuted }]}>Confirm with your current password</Text></View></View>
          <TextInput value={email} onChangeText={(value) => { setEmail(value); setAccountError(''); }} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="name@example.com" placeholderTextColor={palette.textMuted} style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surfaceMuted }]} />
          <PasswordField value={emailCurrentPassword} onChangeText={(value) => { setEmailCurrentPassword(value); setAccountError(''); }} placeholder="Current password" visible={isEmailCurrentPasswordVisible} onToggle={() => setIsEmailCurrentPasswordVisible((visible) => !visible)} palette={palette} />
          <Pressable onPress={saveEmail} disabled={isSavingAccount} style={({ pressed }) => [styles.primaryButton, (pressed || isSavingAccount) && styles.pressed]}>{isSavingAccount ? <ActivityIndicator color={Colors.white} /> : <><MaterialCommunityIcons name="email-check-outline" size={18} color={Colors.white} /><Text style={styles.primaryButtonText}>Save email</Text></>}</Pressable>
        </View>
        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.sectionHeading}><View style={styles.sectionIcon}><MaterialCommunityIcons name="lock-reset" size={20} color={Colors.secondary} /></View><View><Text style={[styles.sectionTitle, { color: palette.text }]}>Change password</Text><Text style={[styles.sectionDetail, { color: palette.textMuted }]}>At least 8 characters with uppercase, lowercase, a number, and a symbol</Text></View></View>
          <PasswordField value={passwordCurrentPassword} onChangeText={(value) => { setPasswordCurrentPassword(value); setAccountError(''); }} placeholder="Current password" visible={isCurrentPasswordVisible} onToggle={() => setIsCurrentPasswordVisible((visible) => !visible)} palette={palette} />
          <PasswordField value={newPassword} onChangeText={(value) => { setNewPassword(value); setAccountError(''); }} placeholder="New password" visible={isNewPasswordVisible} onToggle={() => setIsNewPasswordVisible((visible) => !visible)} palette={palette} />
          <PasswordField value={confirmPassword} onChangeText={(value) => { setConfirmPassword(value); setAccountError(''); }} placeholder="Confirm new password" visible={isConfirmPasswordVisible} onToggle={() => setIsConfirmPasswordVisible((visible) => !visible)} palette={palette} />
          <Pressable onPress={savePassword} disabled={isSavingAccount} style={({ pressed }) => [styles.primaryButton, (pressed || isSavingAccount) && styles.pressed]}>{isSavingAccount ? <ActivityIndicator color={Colors.white} /> : <><MaterialCommunityIcons name="shield-lock-outline" size={18} color={Colors.white} /><Text style={styles.primaryButtonText}>Update password</Text></>}</Pressable>
        </View>
        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}><View style={styles.sectionHeading}><View style={styles.sectionIcon}><MaterialCommunityIcons name="card-account-details-outline" size={20} color={Colors.secondary} /></View><View><Text style={[styles.sectionTitle, { color: palette.text }]}>Personal information</Text><Text style={[styles.sectionDetail, { color: palette.textMuted }]}>Update the details attached to your account</Text></View></View><View style={styles.detailList}><DetailRow label="Name" value={user?.name || 'Not provided'} /><DetailRow label="Email" value={user?.email || 'Not provided'} /><DetailRow label="Role" value={user?.role || 'Not provided'} /></View><Pressable onPress={editInformation} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><MaterialCommunityIcons name="pencil-outline" size={18} color={Colors.primary} /><Text style={styles.secondaryButtonText}>Edit information</Text></Pressable></View>
      </ScrollView>
      <Modal transparent visible={isProfileEditorOpen} animationType="fade" onRequestClose={() => setIsProfileEditorOpen(false)}>
        <Pressable style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.42)' }]} onPress={() => setIsProfileEditorOpen(false)}>
          <Pressable style={{ width: '100%', maxWidth: 460, padding: Spacing.lg, borderRadius: BorderRadius.md, backgroundColor: palette.surface }} onPress={(event) => event.stopPropagation()}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Edit personal information</Text>
            <TextInput value={firstName} onChangeText={setFirstName} placeholder="First name" placeholderTextColor={palette.textMuted} style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surfaceMuted }]} />
            <TextInput value={middleName} onChangeText={setMiddleName} placeholder="Middle name (optional)" placeholderTextColor={palette.textMuted} style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surfaceMuted }]} />
            <TextInput value={lastName} onChangeText={setLastName} placeholder="Last name" placeholderTextColor={palette.textMuted} style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surfaceMuted }]} />
            {!!profileError && <Text style={{ color: Colors.emergency, fontSize: 12, marginTop: Spacing.sm }}>{profileError}</Text>}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.md }}>
              <Pressable onPress={() => setIsProfileEditorOpen(false)} style={{ minHeight: 44, paddingHorizontal: Spacing.md, justifyContent: 'center' }} disabled={isSavingProfile}><Text style={[styles.secondaryButtonText, { color: palette.textMuted }]}>Cancel</Text></Pressable>
              <Pressable onPress={() => void saveProfile()} style={styles.primaryButton} disabled={isSavingProfile}>{isSavingProfile ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryButtonText}>Save information</Text>}</Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal transparent visible={isSuccessModalOpen} animationType="fade" onRequestClose={() => setIsSuccessModalOpen(false)}>
        <Pressable style={styles.successBackdrop} onPress={() => setIsSuccessModalOpen(false)}>
          <Pressable style={[styles.successDialog, { backgroundColor: palette.surface }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.successIcon}><MaterialCommunityIcons name="check" size={27} color={Colors.white} /></View>
            <Text style={[styles.successTitle, { color: palette.text }]}>Account updated</Text>
            <Text style={[styles.successMessage, { color: palette.textMuted }]}>{successMessage}</Text>
            <Pressable style={styles.successDoneButton} onPress={() => setIsSuccessModalOpen(false)} accessibilityRole="button"><Text style={styles.primaryButtonText}>Done</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) { return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>; }

type AccountPalette = ReturnType<typeof useTheme>['palette'];

function PasswordField({ value, onChangeText, placeholder, visible, onToggle, palette }: { value: string; onChangeText: (value: string) => void; placeholder: string; visible: boolean; onToggle: () => void; palette: AccountPalette }) {
  return (
    <View style={styles.passwordInput}>
      <TextInput value={value} onChangeText={onChangeText} secureTextEntry={!visible} autoCapitalize="none" autoComplete={placeholder.toLowerCase().includes('current') ? 'current-password' : 'new-password'} placeholder={placeholder} placeholderTextColor={palette.textMuted} style={[styles.input, styles.passwordInputField, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surfaceMuted }]} />
      <Pressable onPress={onToggle} style={styles.passwordToggle} accessibilityRole="button" accessibilityLabel={visible ? `Hide ${placeholder.toLowerCase()}` : `Show ${placeholder.toLowerCase()}`}>
        <MaterialCommunityIcons name={visible ? 'eye-off-outline' : 'eye-outline'} size={21} color={palette.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  accountError: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: Spacing.md, padding: Spacing.md, borderWidth: 1, borderColor: '#E8B4B0', borderRadius: BorderRadius.md, backgroundColor: '#FFF4F2' },
  accountErrorText: { flex: 1, color: Colors.emergency, fontSize: 12, lineHeight: 17 },
  passwordInput: { position: 'relative', justifyContent: 'center' },
  passwordInputField: { paddingRight: 54 },
  passwordToggle: { position: 'absolute', right: 3, top: Spacing.lg + 1, width: 44, height: 46, alignItems: 'center', justifyContent: 'center' },
  successBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, backgroundColor: 'rgba(0,0,0,0.42)' },
  successDialog: { width: '100%', maxWidth: 380, alignItems: 'center', padding: Spacing.xl, borderRadius: BorderRadius.lg, backgroundColor: Colors.surface },
  successIcon: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 27, backgroundColor: Colors.success },
  successTitle: { marginTop: Spacing.md, color: Colors.text, fontSize: 19, fontWeight: '800', textAlign: 'center' },
  successMessage: { marginTop: Spacing.sm, color: Colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  successDoneButton: { alignSelf: 'stretch', minHeight: 46, marginTop: Spacing.md, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: '#218B25' },
  safeArea: { flex: 1, backgroundColor: Colors.surface }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface }, content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: Spacing['3xl'] }, header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, backgroundColor: '#218B25', flexDirection: 'row', alignItems: 'center', gap: Spacing.md }, backButton: { width: 42, height: 42, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' }, eyebrow: { color: '#D8F0D8', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 }, title: { marginTop: 2, color: Colors.white, fontSize: 28, fontWeight: '800' }, profileCard: { marginTop: Spacing.lg, marginBottom: Spacing.lg, padding: Spacing.lg, borderWidth: 1, borderColor: '#8BC58B', borderRadius: BorderRadius.md, backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center' }, avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceMuted, borderWidth: 1, borderColor: '#218B25' }, profileCopy: { flex: 1, marginLeft: Spacing.lg }, name: { color: Colors.text, fontSize: 20, fontWeight: '800' }, email: { marginTop: 4, color: Colors.textMuted, fontSize: 12 }, rolePill: { alignSelf: 'flex-start', marginTop: Spacing.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm, backgroundColor: Colors.surfaceMuted }, roleText: { color: '#218B25', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  section: { marginBottom: Spacing.lg, padding: Spacing.lg, borderWidth: 1, borderColor: '#8BC58B', borderRadius: BorderRadius.md, backgroundColor: Colors.surface }, sectionHeading: { flexDirection: 'row', alignItems: 'center' }, sectionIcon: { width: 38, height: 38, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceMuted }, sectionTitle: { marginLeft: Spacing.md, color: Colors.text, fontSize: 16, fontWeight: '800' }, sectionDetail: { marginLeft: Spacing.md, marginTop: 2, color: Colors.textMuted, fontSize: 11 }, input: { height: 48, marginTop: Spacing.lg, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: '#D7E0E7', borderRadius: BorderRadius.md, color: Colors.text, backgroundColor: Colors.background, fontSize: 14 }, primaryButton: { height: 46, marginTop: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: Spacing.sm, backgroundColor: '#218B25' }, primaryButtonText: { color: Colors.white, fontSize: 14, fontWeight: '800' }, detailList: { marginTop: Spacing.lg, borderTopWidth: 1, borderTopColor: '#E8EDF1' }, detailRow: { minHeight: 45, borderBottomWidth: 1, borderBottomColor: '#E8EDF1', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md }, detailLabel: { color: Colors.textMuted, fontSize: 12 }, detailValue: { flex: 1, color: Colors.text, fontSize: 13, fontWeight: '700', textAlign: 'right' }, secondaryButton: { height: 46, marginTop: Spacing.lg, borderWidth: 1, borderColor: '#218B25', borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: Spacing.sm }, secondaryButtonText: { color: Colors.text, fontSize: 14, fontWeight: '800' }, pressed: { opacity: 0.78 },
});