import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, BorderRadius, Spacing } from '@constants/colors';
import { useAuth } from '@hooks/useAuth';
import { useResponsiveLayout } from '@hooks/useResponsiveLayout';
import { useTheme } from '@hooks/useTheme';
import AppBackArrow from '@components/AppBackArrow';
import Avatar from '@components/Avatar';

const accountSections = [
  { path: 'contact-number', title: 'Contact number', detail: 'Keep your phone number current', icon: 'phone-outline' as const },
  { path: 'email', title: 'Change email', detail: 'Update the email used to sign in', icon: 'email-edit-outline' as const },
  { path: 'password', title: 'Change password', detail: 'Keep your account secure', icon: 'lock-reset' as const },
  { path: 'profile', title: 'Personal information', detail: 'Edit your name, birthdate, sex, and address', icon: 'card-account-details-outline' as const },
];

export default function AccountHub() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { gutter } = useResponsiveLayout();
  const { palette } = useTheme();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/(auth)/login');
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) return <View style={[styles.loading, { backgroundColor: palette.background }]}><ActivityIndicator color={Colors.secondary} /></View>;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <AppBackArrow />
          <View><Text style={styles.eyebrow}>YOUR PROFILE</Text><Text style={styles.title}>Account</Text></View>
        </View>

        <View style={[styles.profileCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Avatar uri={user?.profilePicture} name={user?.name} size={58} />
          <View style={styles.profileCopy}>
            <Text style={[styles.name, { color: palette.text }]}>{user?.name || 'HANDA User'}</Text>
            <Text style={[styles.email, { color: palette.textMuted }]}>{user?.email || 'No email available'}</Text>
          </View>
        </View>

        <Text style={[styles.sectionHeading, { color: palette.text }]}>Account settings</Text>
        <View style={[styles.sectionList, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          {accountSections.map((section, index) => {
            const value = section.path === 'contact-number'
              ? user?.mobileNumber || 'Not set'
              : section.path === 'email'
                ? user?.email || 'Not set'
                : section.path === 'profile'
                  ? [user?.birthday, user?.sex, user?.currentAddress].filter(Boolean).join(' · ') || 'Review your details'
                  : 'Update your password';
            return (
              <Pressable
                key={section.path}
                onPress={() => router.push(`/account/${section.path}`)}
                style={({ pressed }) => [styles.sectionRow, index < accountSections.length - 1 && styles.sectionDivider, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <View style={styles.sectionIcon}><MaterialCommunityIcons name={section.icon} size={20} color={Colors.success} /></View>
                <View style={styles.sectionCopy}>
                  <Text style={[styles.sectionTitle, { color: palette.text }]}>{section.title}</Text>
                  <Text style={[styles.sectionDetail, { color: palette.textMuted }]}>{section.detail}</Text>
                  <Text style={styles.sectionValue} numberOfLines={1}>{value}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={21} color={palette.textMuted} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: Spacing['3xl'] },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, backgroundColor: '#218B25', flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  eyebrow: { color: '#D8F0D8', fontSize: 10, fontWeight: '800' },
  title: { marginTop: 2, color: Colors.white, fontSize: 27, fontWeight: '800' },
  profileCard: { marginTop: Spacing.lg, marginBottom: Spacing.xl, padding: Spacing.lg, borderWidth: 1, borderRadius: BorderRadius.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F2E8' },
  profileCopy: { flex: 1 },
  name: { fontSize: 18, fontWeight: '800' },
  email: { marginTop: 4, fontSize: 13 },
  sectionHeading: { marginBottom: Spacing.sm, fontSize: 16, fontWeight: '800' },
  sectionList: { borderWidth: 1, borderRadius: BorderRadius.md, overflow: 'hidden' },
  sectionRow: { minHeight: 88, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  sectionDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  sectionIcon: { width: 40, height: 40, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F2E8' },
  sectionCopy: { flex: 1 },
  sectionTitle: { fontSize: 14, fontWeight: '800' },
  sectionDetail: { marginTop: 2, fontSize: 12, lineHeight: 17 },
  sectionValue: { marginTop: 4, color: '#218B25', fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});