import React, { useEffect } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing } from '@constants/colors';
import { useAuth } from '@hooks/useAuth';
import { useResponsiveLayout } from '@hooks/useResponsiveLayout';
import { useTheme } from '@hooks/useTheme';
import Avatar from '@components/Avatar';
import { AnimatedPressable } from '@components/Buttons';
import { GradientHeader, Reveal, kitFonts } from '@components/ScreenKit';

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
        <View style={{ marginHorizontal: -gutter }}>
          <GradientHeader
            title="Account"
            subtitle="Your profile and account security"
            icon="account-cog-outline"
            showBack
            fallbackHref={user?.role === 'responder' ? '/(responder)/more' : user?.role === 'resident' ? '/(resident)/more' : '/'}
          />
        </View>

        <Reveal index={0}>
          <View style={[styles.profileCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={styles.avatarRing}>
              <Avatar uri={user?.profilePicture} name={user?.name} size={58} />
            </View>
            <View style={styles.profileCopy}>
              <Text numberOfLines={1} style={[styles.name, { color: palette.text }]}>{user?.name || 'HANDA User'}</Text>
              <Text numberOfLines={1} style={[styles.email, { color: palette.textMuted }]}>{user?.email || 'No email available'}</Text>
              <View style={styles.verifiedRow}>
                <MaterialCommunityIcons name="shield-check" size={14} color="#218B25" />
                <Text style={styles.verifiedText}>Account profile</Text>
              </View>
            </View>
          </View>
        </Reveal>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionHeading, { color: palette.text }]}>Account settings</Text>
            <Text style={[styles.sectionCaption, { color: palette.textMuted }]}>Manage your information and sign-in security</Text>
          </View>
          <View style={styles.sectionBadge}><MaterialCommunityIcons name="account-edit-outline" size={18} color="#218B25" /></View>
        </View>
        <View style={styles.sectionList}>
          {accountSections.map((section, index) => {
            const value = section.path === 'contact-number'
              ? user?.mobileNumber || 'Not set'
              : section.path === 'email'
                ? user?.email || 'Not set'
                : section.path === 'profile'
                  ? [user?.birthday, user?.sex, user?.currentAddress].filter(Boolean).join(' · ') || 'Review your details'
                  : 'Update your password';
            return (
              <Reveal key={section.path} index={index + 1}>
                <AnimatedPressable
                  onPress={() => router.push(`/account/${section.path}`)}
                  style={[styles.sectionRow, { backgroundColor: palette.surface, borderColor: palette.border }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${section.title}. ${section.detail}. ${value}`}
                >
                  <View style={styles.sectionIcon}><MaterialCommunityIcons name={section.icon} size={21} color="#218B25" /></View>
                  <View style={styles.sectionCopy}>
                    <Text style={[styles.sectionTitle, { color: palette.text }]}>{section.title}</Text>
                    <Text style={[styles.sectionDetail, { color: palette.textMuted }]}>{section.detail}</Text>
                    <Text style={styles.sectionValue} numberOfLines={1}>{value}</Text>
                  </View>
                  <View style={[styles.chevron, { backgroundColor: palette.background }]}>
                    <MaterialCommunityIcons name="chevron-right" size={19} color={palette.textMuted} />
                  </View>
                </AnimatedPressable>
              </Reveal>
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
  profileCard: { marginTop: 18, marginBottom: 24, padding: 16, borderWidth: 1, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatarRing: { padding: 3, borderWidth: 1, borderColor: 'rgba(33,139,37,0.25)', borderRadius: 33 },
  profileCopy: { flex: 1, minWidth: 0 },
  name: { fontFamily: kitFonts.heading, fontSize: 17 },
  email: { marginTop: 4, fontFamily: kitFonts.medium, fontSize: 12 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7 },
  verifiedText: { color: '#218B25', fontFamily: kitFonts.semibold, fontSize: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionHeading: { fontFamily: kitFonts.heading, fontSize: 18 },
  sectionCaption: { marginTop: 4, fontFamily: kitFonts.medium, fontSize: 11 },
  sectionBadge: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(33,139,37,0.1)' },
  sectionList: { gap: 9 },
  sectionRow: { minHeight: 88, paddingHorizontal: 13, paddingVertical: 13, borderWidth: 1, borderRadius: 17, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(33,139,37,0.1)' },
  sectionCopy: { flex: 1, minWidth: 0 },
  sectionTitle: { fontFamily: kitFonts.semibold, fontSize: 14 },
  sectionDetail: { marginTop: 3, fontFamily: kitFonts.medium, fontSize: 11, lineHeight: 16 },
  sectionValue: { marginTop: 5, color: '#218B25', fontFamily: kitFonts.semibold, fontSize: 11 },
  chevron: { width: 30, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});