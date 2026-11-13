import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing } from '@constants/colors';
import { useAuth } from '@hooks/useAuth';
import { useResponsiveLayout } from '@hooks/useResponsiveLayout';
import { ThemeMode, useTheme } from '@hooks/useTheme';
import { authenticatedFetch } from '@services/apiClient';
import { GradientHeader, Reveal, kitFonts } from '@components/ScreenKit';

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
  const { isAuthenticated, isLoading, user } = useAuth();
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
        <View style={{ marginHorizontal: -gutter }}>
          <GradientHeader
            title="Settings"
            subtitle="Personalize your HANDA experience"
            icon="tune-variant"
            showBack
            fallbackHref={user?.role === 'responder' ? '/(responder)/more' : user?.role === 'resident' ? '/(resident)/more' : '/'}
          />
        </View>
        <Reveal index={0}>
          <View style={styles.intro}>
            <Text style={[styles.introTitle, { color: palette.text }]}>Make HANDA yours</Text>
            <Text style={[styles.introText, { color: palette.textMuted }]}>Choose how HANDA looks and how you receive incident response alerts.</Text>
          </View>
        </Reveal>
        <Reveal index={1}>
          <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={styles.sectionHeading}>
              <View style={styles.sectionIcon}><MaterialCommunityIcons name="theme-light-dark" size={20} color={Colors.secondary} /></View>
              <View><Text style={[styles.sectionTitle, { color: palette.text }]}>Appearance</Text><Text style={[styles.sectionDetail, { color: palette.textMuted }]}>Changes apply immediately</Text></View>
            </View>
            <View style={styles.themeList}>
              {themeOptions.map((option) => {
                const selected = option.value === mode;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => void setMode(option.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[styles.themeOption, { backgroundColor: palette.background, borderColor: selected ? '#218B25' : palette.border }, selected && styles.themeOptionSelected]}
                  >
                    <View style={[styles.themeOptionIcon, selected && styles.themeOptionIconSelected]}>
                      <MaterialCommunityIcons name={option.icon} size={20} color={selected ? '#218B25' : palette.textMuted} />
                    </View>
                    <View style={styles.themeCopy}>
                      <Text style={[styles.themeLabel, { color: palette.text }]}>{option.label}</Text>
                      <Text style={[styles.themeDetail, { color: palette.textMuted }]}>{option.detail}</Text>
                    </View>
                    {selected && <MaterialCommunityIcons name="check-circle" size={20} color="#218B25" />}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Reveal>
        <Reveal index={2}>
          <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={styles.sectionHeading}>
              <View style={styles.sectionIcon}><MaterialCommunityIcons name="bell-outline" size={20} color={Colors.secondary} /></View>
              <View style={styles.notificationHeading}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Notifications</Text>
                <Text style={[styles.sectionDetail, { color: palette.textMuted }]}>Choose how incident and evacuation-center updates reach you. In-app alerts remain on.</Text>
              </View>
            </View>
            {isLoadingNotificationPreferences ? <ActivityIndicator style={styles.preferenceLoading} color={Colors.secondary} /> : notificationPreferences ? <View style={styles.preferenceList}>
              <PreferenceSwitch
                title="Email alerts"
                detail={notificationPreferences.emailAvailable
                  ? `Send incident and evacuation-center updates to ${notificationPreferences.emailAddress}.`
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
                  ? `Send incident and evacuation-center updates to ${notificationPreferences.mobileNumber || 'your account mobile number'}.`
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
            </View> : <View style={styles.preferenceErrorRow}>
              <Text style={styles.preferenceError}>{notificationPreferencesError || 'Alert preferences are unavailable.'}</Text>
              <Pressable onPress={() => {
                setIsLoadingNotificationPreferences(true);
                setNotificationPreferencesError('');
                void authenticatedFetch('/api/v1/notifications/preferences')
                  .then(async (response) => {
                    if (!response.ok) throw new Error('Alert preferences could not be loaded.');
                    setNotificationPreferences(await response.json() as NotificationPreferences);
                  })
                  .catch(() => setNotificationPreferencesError('Alert preferences could not be loaded.'))
                  .finally(() => setIsLoadingNotificationPreferences(false));
              }}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>}
          </View>
        </Reveal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: Spacing['3xl'] },
  intro: { paddingTop: Spacing.xl, paddingBottom: Spacing.md },
  introTitle: { fontFamily: kitFonts.heading, fontSize: 20 },
  introText: { maxWidth: 560, marginTop: 5, fontFamily: kitFonts.medium, fontSize: 13, lineHeight: 20 },
  section: { marginBottom: Spacing.md, padding: Spacing.lg, borderWidth: 1, borderRadius: 20 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center' },
  sectionIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(33,139,37,0.1)' },
  sectionTitle: { marginLeft: Spacing.md, fontFamily: kitFonts.heading, fontSize: 16 },
  sectionDetail: { maxWidth: 520, marginLeft: Spacing.md, marginTop: 3, fontFamily: kitFonts.medium, fontSize: 11, lineHeight: 16 },
  themeList: { marginTop: Spacing.lg, gap: 9 },
  themeOption: { minHeight: 68, paddingHorizontal: Spacing.md, paddingVertical: 9, borderWidth: 1, borderRadius: 16, flexDirection: 'row', alignItems: 'center' },
  themeOptionSelected: { backgroundColor: 'rgba(33,139,37,0.07)' },
  themeOptionIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(102,112,133,0.08)' },
  themeOptionIconSelected: { backgroundColor: 'rgba(33,139,37,0.12)' },
  themeCopy: { flex: 1, marginLeft: Spacing.md },
  themeLabel: { fontFamily: kitFonts.semibold, fontSize: 14 },
  themeDetail: { marginTop: 3, fontFamily: kitFonts.medium, fontSize: 11 },
  notificationHeading: { flex: 1 },
  preferenceLoading: { marginVertical: Spacing.xl },
  preferenceList: { marginTop: Spacing.md },
  preferenceRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  preferenceIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(33,139,37,0.1)' },
  preferenceCopy: { flex: 1 },
  preferenceTitle: { fontFamily: kitFonts.semibold, fontSize: 14 },
  preferenceDetail: { marginTop: 3, fontFamily: kitFonts.medium, fontSize: 11, lineHeight: 16 },
  preferenceDivider: { height: StyleSheet.hairlineWidth, marginLeft: 52 },
  preferenceError: { marginTop: Spacing.sm, color: Colors.emergency, fontFamily: kitFonts.medium, fontSize: 12, lineHeight: 17 },
  preferenceSaved: { marginTop: Spacing.sm, color: Colors.success, fontFamily: kitFonts.semibold, fontSize: 12 },
  preferenceErrorRow: { marginTop: Spacing.md },
  retryText: { marginTop: Spacing.sm, color: Colors.secondary, fontFamily: kitFonts.bold, fontSize: 13 },
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