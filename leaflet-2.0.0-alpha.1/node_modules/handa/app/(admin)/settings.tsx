import React, { useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, BorderRadius, Spacing } from '@constants/colors';
import { useAuth } from '@hooks/useAuth';
import { ThemeMode, useTheme } from '@hooks/useTheme';

const themeOptions: Array<{ value: ThemeMode; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; detail: string }> = [
  { value: 'light', label: 'Light', icon: 'white-balance-sunny', detail: 'Keep the interface bright' },
  { value: 'dark', label: 'Dark', icon: 'weather-night', detail: 'Use a darker interface' },
  { value: 'system', label: 'System', icon: 'cellphone-cog', detail: 'Follow your device preference' },
];

export default function AdminSettings() {
  const router = useRouter();
  const { user, setAuthenticatedUser } = useAuth();
  const { mode, palette, setMode } = useTheme();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const saveProfile = async () => {
    if (!user || !name.trim()) {
      Alert.alert('Name required', 'Enter a name before saving your profile.');
      return;
    }
    await setAuthenticatedUser({ ...user, name: name.trim() });
    Alert.alert('Profile updated', 'Your profile name has been saved.');
  };

  const saveEmail = async () => {
    if (!user || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Invalid email', 'Enter a valid email address before saving.');
      return;
    }
    await setAuthenticatedUser({ ...user, email: email.trim().toLowerCase() });
    Alert.alert('Email updated', 'Your email address has been saved locally.');
  };

  const changePassword = () => {
    if (!currentPassword || newPassword.length < 8 || newPassword !== confirmPassword) {
      Alert.alert('Check password details', 'Enter your current password, use at least 8 characters, and make both new passwords match.');
      return;
    }
    Alert.alert('Password service unavailable', 'The password update API is not connected yet. Your password was not changed.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Go back">
            <MaterialCommunityIcons name="arrow-left" size={23} color={Colors.white} />
          </Pressable>
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
          <SectionHeading icon="account-edit-outline" title="Edit profile" detail="Update the name shown in the console" palette={palette} />
          <Field label="Full name" value={name} onChangeText={setName} palette={palette} />
          <ActionButton label="Save profile" icon="content-save-outline" onPress={() => void saveProfile()} />
        </View>

        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <SectionHeading icon="email-edit-outline" title="Change email" detail="Use this address for future account communication" palette={palette} />
          <Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" palette={palette} />
          <ActionButton label="Save email" icon="email-check-outline" onPress={() => void saveEmail()} />
        </View>

        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <SectionHeading icon="lock-reset" title="Change password" detail="Keep your administrator account protected" palette={palette} />
          <Field label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry palette={palette} />
          <Field label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry palette={palette} />
          <Field label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry palette={palette} />
          <ActionButton label="Update password" icon="shield-lock-outline" onPress={changePassword} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeading({ icon, title, detail, palette }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; title: string; detail: string; palette: { text: string; textMuted: string } }) {
  return <View style={styles.sectionHeading}><View style={styles.sectionIcon}><MaterialCommunityIcons name={icon} size={20} color={Colors.secondary} /></View><View><Text style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text><Text style={[styles.sectionDetail, { color: palette.textMuted }]}>{detail}</Text></View></View>;
}

function Field({ label, value, onChangeText, palette, keyboardType = 'default', autoCapitalize = 'sentences', secureTextEntry = false }: { label: string; value: string; onChangeText: (value: string) => void; palette: { surfaceMuted: string; border: string; text: string; textMuted: string }; keyboardType?: 'default' | 'email-address'; autoCapitalize?: 'none' | 'sentences'; secureTextEntry?: boolean }) {
  return <View style={styles.field}><Text style={[styles.fieldLabel, { color: palette.text }]}>{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} autoCapitalize={autoCapitalize} secureTextEntry={secureTextEntry} placeholderTextColor={palette.textMuted} style={[styles.input, { backgroundColor: palette.surfaceMuted, borderColor: palette.border, color: palette.text }]} /></View>;
}

function ActionButton({ label, icon, onPress }: { label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}><MaterialCommunityIcons name={icon} size={18} color={Colors.white} /><Text style={styles.actionButtonText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 }, content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: Spacing['3xl'] },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, backgroundColor: '#218B25', flexDirection: 'row', alignItems: 'center', gap: Spacing.md }, backButton: { width: 42, height: 42, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' }, eyebrow: { color: '#D8F0D8', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 }, title: { marginTop: 2, color: Colors.white, fontSize: 28, fontWeight: '800' },
  intro: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.lg }, introTitle: { fontSize: 21, fontWeight: '800' }, introText: { maxWidth: 620, marginTop: Spacing.xs, fontSize: 13, lineHeight: 20 },
  section: { marginHorizontal: Spacing.lg, marginBottom: Spacing.lg, padding: Spacing.lg, borderWidth: 1, borderRadius: BorderRadius.md }, sectionHeading: { flexDirection: 'row', alignItems: 'center' }, sectionIcon: { width: 38, height: 38, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceMuted }, sectionTitle: { marginLeft: Spacing.md, fontSize: 16, fontWeight: '800' }, sectionDetail: { marginLeft: Spacing.md, marginTop: 2, fontSize: 11 },
  themeList: { marginTop: Spacing.lg, gap: Spacing.sm }, themeOption: { minHeight: 64, paddingHorizontal: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.md, flexDirection: 'row', alignItems: 'center' }, themeCopy: { flex: 1, marginLeft: Spacing.md }, themeLabel: { fontSize: 14, fontWeight: '700' }, themeDetail: { marginTop: 3, fontSize: 11 },
  field: { marginTop: Spacing.lg }, fieldLabel: { marginBottom: Spacing.sm, fontSize: 12, fontWeight: '700' }, input: { height: 46, paddingHorizontal: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.md, fontSize: 14 }, actionButton: { height: 44, marginTop: Spacing.lg, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.primary }, actionButtonText: { color: Colors.white, fontSize: 13, fontWeight: '800' }, pressed: { opacity: 0.78 },
});
