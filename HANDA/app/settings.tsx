import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, BorderRadius, Spacing } from '@constants/colors';
import { useAuth } from '@hooks/useAuth';
import { useResponsiveLayout } from '@hooks/useResponsiveLayout';
import { ThemeMode, useTheme } from '@hooks/useTheme';
import { authenticatedFetch } from '@services/apiClient';

const themeOptions: Array<{ value: ThemeMode; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; detail: string }> = [
  { value: 'light', label: 'Light', icon: 'white-balance-sunny', detail: 'Keep the interface bright' },
  { value: 'system', label: 'System', icon: 'cellphone-cog', detail: 'Follow your device preference' },
  { value: 'dark', label: 'Dark', icon: 'weather-night', detail: 'Use a darker interface' },
];

type NotificationPreferences = {
  emailEnabled: boolean;
  smsEnabled: boolean;
  emailConfigured: boolean;
  smsConfigured: boolean;
  emailAvailable: boolean;
  smsAvailable: boolean;
  emailAddress: string;
  mobileNumber: string;
};

export default function SettingsScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { gutter } = useResponsiveLayout();
  const { mode, palette, setMode } = useTheme();
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoadingNotificationPreferences, setIsLoadingNotificationPreferences] = useState(true);
  const [savingChannel, setSavingChannel] = useState<'email' | 'sms' | null>(null);
  const [notificationPreferencesError, setNotificationPreferencesError] = useState('');
  const [notificationPreferencesMessage, setNotificationPreferencesMessage] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/(auth)/login');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return undefined;
    let isMounted = true;
    setIsLoadingNotificationPreferences(true);
    void authenticatedFetch('/api/v1/notifications/preferences')
      .then(async (response) => {
        if (!response.ok) throw new Error('Alert preferences could not be loaded.');
        const preferences = await response.json() as NotificationPreferences;
        if (isMounted) {
          setNotificationPreferences(preferences);
          setNotificationPreferencesError('');
        }
      })
      .catch((error: unknown) => {
        if (isMounted) setNotificationPreferencesError(error instanceof Error ? error.message : 'Alert preferences could not be loaded.');
      })
      .finally(() => {
        if (isMounted) setIsLoadingNotificationPreferences(false);
      });
    return () => { isMounted = false; };
  }, [isAuthenticated, isLoading]);

  const updateNotificationPreference = async (channel: 'email' | 'sms', enabled: boolean) => {
    if (!notificationPreferences || savingChannel) return;
    setSavingChannel(channel);
    setNotificationPreferencesError('');
    setNotificationPreferencesMessage('');
    try {
      const response = await authenticatedFetch('/api/v1/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(channel === 'email' ? { emailEnabled: enabled } : { smsEnabled: enabled }),
      });
      if (!response.ok) throw new Error('Your alert preference could not be saved. Try again.');
      setNotificationPreferences(await response.json() as NotificationPreferences);
      setNotificationPreferencesMessage('Alert preferences saved.');
    } catch (error) {
      setNotificationPreferencesError(error instanceof Error ? error.message : 'Your alert preference could not be saved. Try again.');
    } finally {
      setSavingChannel(null);
    }
  };

  if (isLoading || !isAuthenticated) return <View style={[styles.loading, { backgroundColor: palette.background }]}><ActivityIndicator color={Colors.secondary} /></View>;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Go back"><MaterialCommunityIcons name="arrow-left" size={23} color={Colors.white} /></Pressable>
          <View><Text style={styles.eyebrow}>PREFERENCES</Text><Text style={styles.title}>Settings</Text></View>
        </View>
        <View style={styles.intro}><Text style={[styles.introTitle, { color: palette.text }]}>Make HANDA yours</Text><Text style={[styles.introText, { color: palette.textMuted }]}>Choose how HANDA should look. Your choice is saved on this device.</Text></View>
        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.sectionHeading}><View style={styles.sectionIcon}><MaterialCommunityIcons name="theme-light-dark" size={20} color={Colors.secondary} /></View><View><Text style={[styles.sectionTitle, { color: palette.text }]}>Appearance</Text><Text style={[styles.sectionDetail, { color: palette.textMuted }]}>Changes apply immediately</Text></View></View>
          <View style={styles.themeList}>{themeOptions.map((option) => { const selected = option.value === mode; return <Pressable key={option.value} onPress={() => void setMode(option.value)} accessibilityRole="radio" accessibilityState={{ selected }} style={[styles.themeOption, { borderColor: palette.border }, selected && styles.themeOptionSelected]}><MaterialCommunityIcons name={option.icon} size={22} color={selected ? Colors.secondary : palette.textMuted} /><View style={styles.themeCopy}><Text style={[styles.themeLabel, { color: palette.text }]}>{option.label}</Text><Text style={[styles.themeDetail, { color: palette.textMuted }]}>{option.detail}</Text></View>{selected && <MaterialCommunityIcons name="check-circle" size={20} color={Colors.secondary} />}</Pressable>; })}</View>
        </View>
        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.sectionHeading}><View style={styles.sectionIcon}><MaterialCommunityIcons name="bell-outline" size={20} color={Colors.secondary} /></View><View style={styles.notificationHeading}><Text style={[styles.sectionTitle, { color: palette.text }]}>Notifications</Text><Text style={[styles.sectionDetail, { color: palette.textMuted }]}>Choose how incident response alerts reach you. In-app alerts remain on.</Text></View></View>
          {isLoadingNotificationPreferences ? <ActivityIndicator style={styles.preferenceLoading} color={Colors.secondary} /> : notificationPreferences ? <View style={styles.preferenceList}>
            <PreferenceSwitch
              title="Email alerts"
              detail={notificationPreferences.emailAvailable
                ? `Send incident updates to ${notificationPreferences.emailAddress}.`
                : !notificationPreferences.emailConfigured
                  ? 'Email delivery is not configured by the administrator; messages cannot be delivered yet.'
                  : 'An email address is not available for this account.'}
              icon="email-outline"
              value={notificationPreferences.emailEnabled}
              disabled={savingChannel !== null}
              palette={palette}
              onValueChange={(enabled) => void updateNotificationPreference('email', enabled)}
            />
            <View style={[styles.preferenceDivider, { backgroundColor: palette.border }]} />
            <PreferenceSwitch
              title="SMS alerts"
              detail={notificationPreferences.smsAvailable
                ? `Send incident updates to ${notificationPreferences.mobileNumber || 'your account mobile number'}.`
                : !notificationPreferences.smsConfigured
                  ? 'SMS delivery is not configured by the administrator; messages cannot be delivered yet.'
                  : 'A mobile number is not available for this account.'}
              icon="message-text-outline"
              value={notificationPreferences.smsEnabled}
              disabled={savingChannel !== null}
              palette={palette}
              onValueChange={(enabled) => void updateNotificationPreference('sms', enabled)}
            />
            {!!notificationPreferencesError && <Text style={styles.preferenceError}>{notificationPreferencesError}</Text>}
            {!!notificationPreferencesMessage && <Text style={styles.preferenceSaved}>{notificationPreferencesMessage}</Text>}
          </View> : <View style={styles.preferenceErrorRow}><Text style={styles.preferenceError}>{notificationPreferencesError || 'Alert preferences are unavailable.'}</Text><Pressable onPress={() => { setIsLoadingNotificationPreferences(true); setNotificationPreferencesError(''); void authenticatedFetch('/api/v1/notifications/preferences').then(async (response) => { if (!response.ok) throw new Error('Alert preferences could not be loaded.'); setNotificationPreferences(await response.json() as NotificationPreferences); }).catch(() => setNotificationPreferencesError('Alert preferences could not be loaded.')).finally(() => setIsLoadingNotificationPreferences(false)); }}><Text style={styles.retryText}>Retry</Text></Pressable></View>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface }, content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: Spacing['3xl'] },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, backgroundColor: '#218B25', flexDirection: 'row', alignItems: 'center', gap: Spacing.md }, backButton: { width: 42, height: 42, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' }, eyebrow: { color: '#D8F0D8', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 }, title: { marginTop: 2, color: Colors.white, fontSize: 28, fontWeight: '800' },
  intro: { paddingTop: Spacing.xl, paddingBottom: Spacing.lg }, introTitle: { color: Colors.text, fontSize: 21, fontWeight: '800' }, introText: { maxWidth: 520, marginTop: Spacing.xs, color: Colors.textMuted, fontSize: 13, lineHeight: 20 }, section: { marginBottom: Spacing.lg, padding: Spacing.lg, borderWidth: 1, borderColor: '#8BC58B', borderRadius: BorderRadius.md, backgroundColor: Colors.surface }, sectionHeading: { flexDirection: 'row', alignItems: 'center' }, sectionIcon: { width: 38, height: 38, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceMuted }, sectionTitle: { marginLeft: Spacing.md, color: Colors.text, fontSize: 16, fontWeight: '800' }, sectionDetail: { marginLeft: Spacing.md, marginTop: 2, color: Colors.textMuted, fontSize: 11 },
  themeList: { marginTop: Spacing.lg, gap: Spacing.sm }, themeOption: { minHeight: 64, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, flexDirection: 'row', alignItems: 'center', opacity: 0.72 }, themeOptionSelected: { borderColor: Colors.secondary, backgroundColor: Colors.surfaceMuted, opacity: 1 }, themeCopy: { flex: 1, marginLeft: Spacing.md }, themeLabel: { color: Colors.text, fontSize: 14, fontWeight: '700' }, themeDetail: { marginTop: 3, color: Colors.textMuted, fontSize: 11 },
  notificationHeading: { flex: 1 }, preferenceLoading: { marginVertical: Spacing.xl }, preferenceList: { marginTop: Spacing.md }, preferenceRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm }, preferenceIcon: { width: 38, height: 38, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceMuted }, preferenceCopy: { flex: 1 }, preferenceTitle: { fontSize: 14, fontWeight: '700' }, preferenceDetail: { marginTop: 3, fontSize: 11, lineHeight: 16 }, preferenceDivider: { height: StyleSheet.hairlineWidth, marginLeft: 50 }, preferenceError: { marginTop: Spacing.sm, color: Colors.emergency, fontSize: 12, lineHeight: 17 }, preferenceSaved: { marginTop: Spacing.sm, color: Colors.success, fontSize: 12, fontWeight: '700' }, preferenceErrorRow: { marginTop: Spacing.md }, retryText: { marginTop: Spacing.sm, color: Colors.secondary, fontSize: 13, fontWeight: '800' },
});

function PreferenceSwitch({ title, detail, icon, value, disabled, palette, onValueChange }: { title: string; detail: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; value: boolean; disabled: boolean; palette: ReturnType<typeof useTheme>['palette']; onValueChange: (value: boolean) => void }) {
  return <View style={styles.preferenceRow}>
    <View style={styles.preferenceIcon}><MaterialCommunityIcons name={icon} size={20} color={Colors.secondary} /></View>
    <View style={styles.preferenceCopy}>
      <Text style={[styles.preferenceTitle, { color: palette.text }]}>{title}</Text>
      <Text style={[styles.preferenceDetail, { color: palette.textMuted }]}>{detail}</Text>
    </View>
    <Switch value={value} onValueChange={onValueChange} disabled={disabled} trackColor={{ false: palette.border, true: '#218B25' }} thumbColor={Colors.white} accessibilityLabel={title} />
  </View>;
}