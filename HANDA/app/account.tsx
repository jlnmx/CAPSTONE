import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, BorderRadius, Spacing } from '@constants/colors';
import { useAuth } from '@hooks/useAuth';
import { useResponsiveLayout } from '@hooks/useResponsiveLayout';
import { useTheme } from '@hooks/useTheme';
import { authenticatedFetch } from '@services/apiClient';
import { AuthUser } from '@types/index';

export default function AccountScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, setAuthenticatedUser } = useAuth();
  const { gutter } = useResponsiveLayout();
  const [contactNumber, setContactNumber] = useState(user?.mobileNumber || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { palette } = useTheme();

  useEffect(() => { if (!isLoading && !isAuthenticated) router.replace('/(auth)/login'); }, [isAuthenticated, isLoading, router]);
  if (isLoading || !isAuthenticated) return <View style={[styles.loading, { backgroundColor: palette.background }]}><ActivityIndicator color={Colors.secondary} /></View>;

  const updateAccount = async (payload: Record<string, string>, successMessage: string) => {
    try {
      const response = await authenticatedFetch('/api/v1/resident/account', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json() as { detail?: unknown } & Partial<AuthUser>;
      if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Your account could not be updated.');
      await setAuthenticatedUser(result as AuthUser);
      Alert.alert('Account updated', successMessage);
    } catch (error) {
      Alert.alert('Update failed', error instanceof Error ? error.message : 'Your account could not be updated.');
    }
  };

  const saveContactNumber = () => void updateAccount({ mobileNumber: contactNumber }, 'Your contact number has been updated.');
  const saveEmail = () => void updateAccount({ email, currentPassword }, 'Your email address has been updated.');
  const savePassword = () => {
    if (!currentPassword || newPassword.length < 8 || newPassword !== confirmPassword) {
      Alert.alert('Check password details', 'Enter your current password, use at least 8 characters, and make both new passwords match.');
      return;
    }
    void updateAccount({ currentPassword, newPassword }, 'Your password has been updated.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };
  const editInformation = () => Alert.alert('Ready to connect', 'This button is ready for the profile editing flow.');

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Go back"><MaterialCommunityIcons name="arrow-left" size={23} color={Colors.white} /></Pressable><View><Text style={styles.eyebrow}>YOUR PROFILE</Text><Text style={styles.title}>Account</Text></View></View>
        <View style={[styles.profileCard, { backgroundColor: palette.surface, borderColor: palette.border }]}><View style={styles.avatar}><MaterialCommunityIcons name="account-outline" size={38} color={Colors.secondary} /></View><View style={styles.profileCopy}><Text style={[styles.name, { color: palette.text }]}>{user?.name || 'HANDA User'}</Text><Text style={[styles.email, { color: palette.textMuted }]}>{user?.email || 'No email available'}</Text><View style={styles.rolePill}><Text style={styles.roleText}>{user?.role || 'resident'}</Text></View></View></View>
        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}><View style={styles.sectionHeading}><View style={styles.sectionIcon}><MaterialCommunityIcons name="phone-outline" size={20} color={Colors.success} /></View><View><Text style={[styles.sectionTitle, { color: palette.text }]}>Contact number</Text><Text style={[styles.sectionDetail, { color: palette.textMuted }]}>Keep your responder contact information current</Text></View></View><TextInput value={contactNumber} onChangeText={setContactNumber} placeholder="09XX XXX XXXX" placeholderTextColor={palette.textMuted} keyboardType="phone-pad" style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surfaceMuted }]} /><Pressable onPress={saveContactNumber} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><MaterialCommunityIcons name="content-save-outline" size={18} color={Colors.white} /><Text style={styles.primaryButtonText}>Save contact number</Text></Pressable></View>
        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}><View style={styles.sectionHeading}><View style={styles.sectionIcon}><MaterialCommunityIcons name="email-edit-outline" size={20} color={Colors.secondary} /></View><View><Text style={[styles.sectionTitle, { color: palette.text }]}>Change email</Text><Text style={[styles.sectionDetail, { color: palette.textMuted }]}>Your current password is required</Text></View></View><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="name@example.com" placeholderTextColor={palette.textMuted} style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surfaceMuted }]} /><TextInput value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry placeholder="Current password" placeholderTextColor={palette.textMuted} style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surfaceMuted }]} /><Pressable onPress={saveEmail} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><MaterialCommunityIcons name="email-check-outline" size={18} color={Colors.white} /><Text style={styles.primaryButtonText}>Save email</Text></Pressable></View>
        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}><View style={styles.sectionHeading}><View style={styles.sectionIcon}><MaterialCommunityIcons name="lock-reset" size={20} color={Colors.secondary} /></View><View><Text style={[styles.sectionTitle, { color: palette.text }]}>Change password</Text><Text style={[styles.sectionDetail, { color: palette.textMuted }]}>Use at least 8 characters with upper, lower, number, and symbol</Text></View></View><TextInput value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="New password" placeholderTextColor={palette.textMuted} style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surfaceMuted }]} /><TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="Confirm new password" placeholderTextColor={palette.textMuted} style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surfaceMuted }]} /><Pressable onPress={savePassword} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><MaterialCommunityIcons name="shield-lock-outline" size={18} color={Colors.white} /><Text style={styles.primaryButtonText}>Update password</Text></Pressable></View>
        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}><View style={styles.sectionHeading}><View style={styles.sectionIcon}><MaterialCommunityIcons name="card-account-details-outline" size={20} color={Colors.secondary} /></View><View><Text style={[styles.sectionTitle, { color: palette.text }]}>Personal information</Text><Text style={[styles.sectionDetail, { color: palette.textMuted }]}>Update the details attached to your account</Text></View></View><View style={styles.detailList}><DetailRow label="Name" value={user?.name || 'Not provided'} /><DetailRow label="Email" value={user?.email || 'Not provided'} /><DetailRow label="Role" value={user?.role || 'Not provided'} /></View><Pressable onPress={editInformation} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><MaterialCommunityIcons name="pencil-outline" size={18} color={Colors.primary} /><Text style={styles.secondaryButtonText}>Edit information</Text></Pressable></View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) { return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface }, content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: Spacing['3xl'] }, header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, backgroundColor: '#218B25', flexDirection: 'row', alignItems: 'center', gap: Spacing.md }, backButton: { width: 42, height: 42, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' }, eyebrow: { color: '#D8F0D8', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 }, title: { marginTop: 2, color: Colors.white, fontSize: 28, fontWeight: '800' }, profileCard: { marginTop: Spacing.lg, marginBottom: Spacing.lg, padding: Spacing.lg, borderWidth: 1, borderColor: '#8BC58B', borderRadius: BorderRadius.md, backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center' }, avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceMuted, borderWidth: 1, borderColor: '#218B25' }, profileCopy: { flex: 1, marginLeft: Spacing.lg }, name: { color: Colors.text, fontSize: 20, fontWeight: '800' }, email: { marginTop: 4, color: Colors.textMuted, fontSize: 12 }, rolePill: { alignSelf: 'flex-start', marginTop: Spacing.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm, backgroundColor: Colors.surfaceMuted }, roleText: { color: '#218B25', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  section: { marginBottom: Spacing.lg, padding: Spacing.lg, borderWidth: 1, borderColor: '#8BC58B', borderRadius: BorderRadius.md, backgroundColor: Colors.surface }, sectionHeading: { flexDirection: 'row', alignItems: 'center' }, sectionIcon: { width: 38, height: 38, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceMuted }, sectionTitle: { marginLeft: Spacing.md, color: Colors.text, fontSize: 16, fontWeight: '800' }, sectionDetail: { marginLeft: Spacing.md, marginTop: 2, color: Colors.textMuted, fontSize: 11 }, input: { height: 48, marginTop: Spacing.lg, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: '#D7E0E7', borderRadius: BorderRadius.md, color: Colors.text, backgroundColor: Colors.background, fontSize: 14 }, primaryButton: { height: 46, marginTop: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: Spacing.sm, backgroundColor: '#218B25' }, primaryButtonText: { color: Colors.white, fontSize: 14, fontWeight: '800' }, detailList: { marginTop: Spacing.lg, borderTopWidth: 1, borderTopColor: '#E8EDF1' }, detailRow: { minHeight: 45, borderBottomWidth: 1, borderBottomColor: '#E8EDF1', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md }, detailLabel: { color: Colors.textMuted, fontSize: 12 }, detailValue: { flex: 1, color: Colors.text, fontSize: 13, fontWeight: '700', textAlign: 'right' }, secondaryButton: { height: 46, marginTop: Spacing.lg, borderWidth: 1, borderColor: '#218B25', borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: Spacing.sm }, secondaryButtonText: { color: Colors.text, fontSize: 14, fontWeight: '800' }, pressed: { opacity: 0.78 },
});