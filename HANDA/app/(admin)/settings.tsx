import React, { useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, BorderRadius, Spacing } from '@constants/colors';
import { useAuth } from '@hooks/useAuth';
import AppBackArrow from '@components/AppBackArrow';
import { ThemeMode, useTheme } from '@hooks/useTheme';
import { authenticatedFetch } from '@services/apiClient';
import { AuthUser } from '@/types/index';

const themeOptions: Array<{ value: ThemeMode; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; detail: string }> = [
  { value: 'light', label: 'Light', icon: 'white-balance-sunny', detail: 'Keep the interface bright' },
  { value: 'dark', label: 'Dark', icon: 'weather-night', detail: 'Use a darker interface' },
  { value: 'system', label: 'System', icon: 'cellphone-cog', detail: 'Follow your device preference' },
];

export default function AdminSettings() {
  const router = useRouter();
  const { user, setAuthenticatedUser } = useAuth();
  const { mode, palette, setMode } = useTheme();
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeChannel, setPasswordChangeChannel] = useState<'email' | 'sms'>(user?.mobileNumber ? 'sms' : 'email');
  const [passwordChangeToken, setPasswordChangeToken] = useState('');
  const [passwordChangeOtp, setPasswordChangeOtp] = useState('');
  const [passwordChangeDestination, setPasswordChangeDestination] = useState('');
  const [isRequestingPasswordOtp, setIsRequestingPasswordOtp] = useState(false);
  const [emailChangeToken, setEmailChangeToken] = useState('');
  const [emailChangeOtp, setEmailChangeOtp] = useState('');
  const [emailChangeDestination, setEmailChangeDestination] = useState('');
  const [emailChangeChannel, setEmailChangeChannel] = useState<'email' | 'sms'>(user?.mobileNumber ? 'sms' : 'email');
  const [isRequestingEmailOtp, setIsRequestingEmailOtp] = useState(false);

  const saveEmail = async () => {
    if (isRequestingEmailOtp) return;
    if (!user || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Invalid email', 'Enter a valid email address before saving.');
      return;
    }
    const nextEmail = email.trim().toLowerCase();
    if (!currentPassword) {
      Alert.alert('Current password required', 'Enter your current password before changing your email.');
      return;
    }
    if (!emailChangeToken) {
      setIsRequestingEmailOtp(true);
      try {
        const response = await authenticatedFetch('/api/v1/auth/email-change/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newEmail: nextEmail, currentPassword, channel: emailChangeChannel }),
        });
        const result = await response.json() as { emailChangeToken?: string; destination?: string; detail?: unknown };
        if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'An email-change code could not be sent.');
        if (!result.emailChangeToken) throw new Error('The verification request did not return a token.');
        setEmailChangeToken(result.emailChangeToken);
        setEmailChangeOtp('');
        setEmailChangeDestination(result.destination || (emailChangeChannel === 'email' ? user.email : user.mobileNumber) || '');
        Alert.alert('Code sent', `Enter the verification code sent to ${result.destination || 'your selected contact'}.`);
      } catch (error) {
        Alert.alert('Could not send code', error instanceof Error ? error.message : 'An email-change code could not be sent.');
      } finally {
        setIsRequestingEmailOtp(false);
      }
      return;
    }
    if (!/^\d{6}$/.test(emailChangeOtp)) {
      Alert.alert('Check verification code', 'Enter the 6-digit code you received.');
      return;
    }
    setIsRequestingEmailOtp(true);
    try {
      const response = await authenticatedFetch('/api/v1/resident/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: nextEmail,
          currentPassword,
          emailChangeToken,
          emailChangeOtp,
        }),
      });
      const result = await response.json() as { detail?: unknown; accessToken?: string } & Partial<AuthUser>;
      if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Your email could not be saved.');
      await setAuthenticatedUser(result as AuthUser, result.accessToken);
      setCurrentPassword('');
      setEmailChangeToken('');
      setEmailChangeOtp('');
      setEmailChangeDestination('');
      Alert.alert('Email updated', 'Your email address has been verified and saved.');
    } catch (error) {
      Alert.alert('Update failed', error instanceof Error ? error.message : 'Your email could not be saved.');
    } finally {
      setIsRequestingEmailOtp(false);
    }
  };

  const changePassword = async () => {
    if (isRequestingPasswordOtp) return;
    if (!currentPassword || newPassword.length < 8 || newPassword !== confirmPassword) {
      Alert.alert('Check password details', 'Enter your current password, use at least 8 characters, and make both new passwords match.');
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      Alert.alert('Check password details', 'Use at least 8 characters with uppercase, lowercase, a number, and a symbol.');
      return;
    }
    if (!passwordChangeToken) {
      setIsRequestingPasswordOtp(true);
      try {
        const response = await authenticatedFetch('/api/v1/auth/password-change/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, channel: passwordChangeChannel }),
        });
        const result = await response.json() as { resetToken?: string; destination?: string; detail?: unknown };
        if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'A verification code could not be sent.');
        if (!result.resetToken) throw new Error('The verification request did not return a token.');
        setPasswordChangeToken(result.resetToken);
        setPasswordChangeDestination(result.destination || '');
        Alert.alert('Code sent', `Enter the verification code sent to ${result.destination || 'your selected contact'}.`);
      } catch (error) {
        Alert.alert('Could not send code', error instanceof Error ? error.message : 'A verification code could not be sent.');
      } finally {
        setIsRequestingPasswordOtp(false);
      }
      return;
    }
    if (!/^\d{6}$/.test(passwordChangeOtp)) {
      Alert.alert('Check verification code', 'Enter the 6-digit code you received.');
      return;
    }
    try {
      const response = await authenticatedFetch('/api/v1/resident/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, passwordChangeToken, passwordChangeOtp }),
      });
      const result = await response.json() as { detail?: unknown; accessToken?: string };
      if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Your password could not be changed.');
      if (user) await setAuthenticatedUser(user, result.accessToken);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordChangeToken('');
      setPasswordChangeOtp('');
      setPasswordChangeDestination('');
      Alert.alert('Password updated', 'Your administrator password has been changed.');
    } catch (error) {
      Alert.alert('Update failed', error instanceof Error ? error.message : 'Your password could not be changed.');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <AppBackArrow style={styles.backButton} />
          <View><Text style={styles.eyebrow}>ADMIN CONSOLE</Text><Text style={styles.title}>Settings</Text></View>
        </View>

        <View style={styles.intro}><Text style={[styles.introTitle, { color: palette.text }]}>Manage your console</Text><Text style={[styles.introText, { color: palette.textMuted }]}>Update appearance and account details for this administrator profile.</Text></View>

        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <SectionHeading icon="theme-light-dark" title="Appearance" detail="Choose how the admin console looks" palette={palette} />
          <View style={styles.themeList}>
            {themeOptions.map((option) => {
              const selected = option.value === mode;
              return <Pressable key={option.value} onPress={() => void setMode(option.value)} accessibilityRole="radio" accessibilityState={{ selected }} style={[styles.themeOption, { borderColor: palette.border, backgroundColor: selected ? palette.surfaceMuted : palette.surface }]}>
                <MaterialCommunityIcons name={option.icon} size={22} color={selected ? Colors.secondary : palette.textMuted} />
                <View style={styles.themeCopy}><Text style={[styles.themeLabel, { color: palette.text }]}>{option.label}</Text><Text style={[styles.themeDetail, { color: palette.textMuted }]}>{option.detail}</Text></View>
                {selected && <MaterialCommunityIcons name="check-circle" size={20} color={Colors.secondary} />}
              </Pressable>;
            })}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <SectionHeading icon="account-edit-outline" title="Personal information" detail="Manage your name, photo, birthdate, address, and position" palette={palette} />
          <ActionButton label="Edit profile details" icon="account-edit-outline" onPress={() => router.push('/account/profile')} />
        </View>

        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <SectionHeading icon="email-edit-outline" title="Change email" detail="Verify with a code sent to your currently registered email or mobile" palette={palette} />
          <Field label="New email address" value={email} onChangeText={(value) => {
            setEmail(value);
            setEmailChangeToken('');
            setEmailChangeOtp('');
            setEmailChangeDestination('');
          }} keyboardType="email-address" autoCapitalize="none" palette={palette} />
          <Field label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry palette={palette} />
          <View style={styles.otpChannelOptions}>
            {(['email', 'sms'] as const).map((channel) => (
              <Pressable key={channel} disabled={channel === 'sms' && !user?.mobileNumber} onPress={() => {
                setEmailChangeChannel(channel);
                setEmailChangeToken('');
                setEmailChangeOtp('');
                setEmailChangeDestination('');
              }} style={[styles.otpChannelOption, { borderColor: emailChangeChannel === channel ? Colors.secondary : palette.border, backgroundColor: palette.surface }, channel === 'sms' && !user?.mobileNumber && styles.disabled]} accessibilityRole="radio" accessibilityState={{ selected: emailChangeChannel === channel }}>
                <MaterialCommunityIcons name={emailChangeChannel === channel ? 'radiobox-marked' : 'radiobox-blank'} size={18} color={emailChangeChannel === channel ? Colors.secondary : palette.textMuted} />
                <Text style={[styles.themeLabel, { color: palette.text }]}>{channel === 'email' ? 'Current email' : 'Current mobile (SMS)'}</Text>
              </Pressable>
            ))}
          </View>
          {!!emailChangeToken && <Field label={`6-digit code sent to ${emailChangeDestination}`} value={emailChangeOtp} onChangeText={(value) => setEmailChangeOtp(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" palette={palette} />}
          <ActionButton label={isRequestingEmailOtp ? 'Please wait...' : emailChangeToken ? 'Verify and save email' : 'Send verification code'} icon="email-check-outline" onPress={() => void saveEmail()} />
        </View>

        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <SectionHeading icon="lock-reset" title="Change password" detail="Keep your administrator account protected" palette={palette} />
          <Field label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry palette={palette} />
          <Field label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry palette={palette} />
          <Field label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry palette={palette} />
          <View style={styles.otpChannelOptions}>
            {(['email', 'sms'] as const).map((channel) => (
              <Pressable key={channel} disabled={channel === 'sms' && !user?.mobileNumber} onPress={() => {
                setPasswordChangeChannel(channel);
                setPasswordChangeToken('');
                setPasswordChangeOtp('');
              }} style={[styles.otpChannelOption, { borderColor: passwordChangeChannel === channel ? Colors.secondary : palette.border, backgroundColor: palette.surface }, channel === 'sms' && !user?.mobileNumber && styles.disabled]} accessibilityRole="radio" accessibilityState={{ selected: passwordChangeChannel === channel }}>
                <MaterialCommunityIcons name={passwordChangeChannel === channel ? 'radiobox-marked' : 'radiobox-blank'} size={18} color={passwordChangeChannel === channel ? Colors.secondary : palette.textMuted} />
                <Text style={[styles.themeLabel, { color: palette.text }]}>{channel === 'email' ? 'Email code' : 'SMS code'}</Text>
              </Pressable>
            ))}
          </View>
          {!!passwordChangeToken && <Field label={`6-digit code sent to ${passwordChangeDestination}`} value={passwordChangeOtp} onChangeText={setPasswordChangeOtp} keyboardType="number-pad" palette={palette} />}
          <ActionButton label={isRequestingPasswordOtp ? 'Sending code...' : passwordChangeToken ? 'Update password' : 'Send verification code'} icon="shield-lock-outline" onPress={changePassword} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeading({ icon, title, detail, palette }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; title: string; detail: string; palette: { text: string; textMuted: string } }) {
  return <View style={styles.sectionHeading}><View style={styles.sectionIcon}><MaterialCommunityIcons name={icon} size={20} color={Colors.secondary} /></View><View><Text style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text><Text style={[styles.sectionDetail, { color: palette.textMuted }]}>{detail}</Text></View></View>;
}

function Field({ label, value, onChangeText, palette, keyboardType = 'default', autoCapitalize = 'sentences', secureTextEntry = false }: { label: string; value: string; onChangeText: (value: string) => void; palette: { surfaceMuted: string; border: string; text: string; textMuted: string }; keyboardType?: 'default' | 'email-address' | 'number-pad'; autoCapitalize?: 'none' | 'sentences'; secureTextEntry?: boolean }) {
  return <View style={styles.field}><Text style={[styles.fieldLabel, { color: palette.text }]}>{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} autoCapitalize={autoCapitalize} secureTextEntry={secureTextEntry} placeholderTextColor={palette.textMuted} style={[styles.input, { backgroundColor: palette.surfaceMuted, borderColor: palette.border, color: palette.text }]} /></View>;
}

function ActionButton({ label, icon, onPress }: { label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}><MaterialCommunityIcons name={icon} size={18} color={Colors.white} /><Text style={styles.actionButtonText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 }, content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: Spacing['3xl'] },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, backgroundColor: '#D45B92', flexDirection: 'row', alignItems: 'center', gap: Spacing.md }, backButton: { width: 42, height: 42, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' }, eyebrow: { color: '#FDEAF1', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 }, title: { marginTop: 2, color: Colors.white, fontSize: 28, fontWeight: '800' },
  intro: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.lg }, introTitle: { fontSize: 21, fontWeight: '800' }, introText: { maxWidth: 620, marginTop: Spacing.xs, fontSize: 13, lineHeight: 20 },
  section: { marginHorizontal: Spacing.lg, marginBottom: Spacing.lg, padding: Spacing.lg, borderWidth: 1, borderRadius: BorderRadius.md }, sectionHeading: { flexDirection: 'row', alignItems: 'center' }, sectionIcon: { width: 38, height: 38, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceMuted }, sectionTitle: { marginLeft: Spacing.md, fontSize: 16, fontWeight: '800' }, sectionDetail: { marginLeft: Spacing.md, marginTop: 2, fontSize: 11 },
  themeList: { marginTop: Spacing.lg, gap: Spacing.sm }, themeOption: { minHeight: 64, paddingHorizontal: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.md, flexDirection: 'row', alignItems: 'center' }, themeCopy: { flex: 1, marginLeft: Spacing.md }, themeLabel: { fontSize: 14, fontWeight: '700' }, themeDetail: { marginTop: 3, fontSize: 11 },
  otpChannelOptions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md }, otpChannelOption: { flex: 1, minHeight: 46, paddingHorizontal: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs },
  disabled: { opacity: 0.5 },
  field: { marginTop: Spacing.lg }, fieldLabel: { marginBottom: Spacing.sm, fontSize: 12, fontWeight: '700' }, input: { height: 46, paddingHorizontal: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.md, fontSize: 14 }, actionButton: { height: 44, marginTop: Spacing.lg, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.primary }, actionButtonText: { color: Colors.white, fontSize: 13, fontWeight: '800' }, pressed: { opacity: 0.78 },
});
