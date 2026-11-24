import { ThemeAwareView, ThemeAwareSafeAreaView, ThemeAwareScrollView, ThemeAwarePressable } from '@components/ThemeAware';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { AnimatedPressable } from '@components/Buttons';
import { ThemedText as Text } from '@components/ThemedText';
import Avatar from '@components/Avatar';
import AppBackArrow from '@components/AppBackArrow';
import { Reveal, kitFonts } from '@components/IncidentCardKit';
import { Colors } from '@constants/colors';
import RescueMascot from '@components/RescueMascot';
import { useAuth } from '@hooks/useAuth';
import { useTheme } from '@hooks/useTheme';
import { claimUnassignedLocalData, getFailedSyncCount, getPendingSyncCount, getUnclaimedPendingOutboxCount } from '@services/localDatabase';
import { syncPendingLocalData } from '@services/syncService';

interface MoreMenuProps {
  roleLabel: string;
}

type MenuItem = {
  title: string;
  description: string;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  mascot?: boolean;
  onPress: () => void;
};

export function MoreMenu({ roleLabel }: MoreMenuProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { palette } = useTheme();
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isRecoveringOfflineData, setIsRecoveringOfflineData] = useState(false);
  const [offlineCounts, setOfflineCounts] = useState({ accountPending: 0, accountFailed: 0, unclaimed: 0 });
  const [offlineCountsLoaded, setOfflineCountsLoaded] = useState(false);
  const [unclaimedDisposition, setUnclaimedDisposition] = useState<'unresolved' | 'claimed' | 'kept'>('unresolved');
  const displayName = user?.name || 'HANDA User';

  useEffect(() => {
    if (!isLogoutDialogOpen || !user?.id) return;
    setOfflineCountsLoaded(false);
    try {
      setOfflineCounts({
        accountPending: getPendingSyncCount(user.id),
        accountFailed: getFailedSyncCount(user.id),
        unclaimed: getUnclaimedPendingOutboxCount(),
      });
      setOfflineCountsLoaded(true);
    } catch (error) {
      console.error('Could not inspect saved offline reports:', error);
      setOfflineCountsLoaded(true);
    }
  }, [isLogoutDialogOpen, user?.id]);

  const menuItems: MenuItem[] = [
    { title: 'Settings', description: 'Personalize your app experience', icon: 'cog-outline', onPress: () => router.push('/settings') },
    { title: 'Account', description: 'Manage your profile and details', icon: 'account-outline', onPress: () => router.push('/account') },
    {
      title: 'Kaya',
      description: 'Your HANDA safety companion',
      mascot: true,
      onPress: () => router.push(roleLabel === 'Resident' ? '/(resident)/chatbot' : '/(responder)/chatbot'),
    },
    { title: 'Developer details', description: 'Learn about the team behind HANDA', icon: 'code-braces', onPress: () => router.push('/developers') },
  ];

  const handleLogout = async () => {
    if (isLoggingOut) return;
    if (!offlineCountsLoaded || (offlineCounts.unclaimed > 0 && unclaimedDisposition === 'unresolved')) return;
    setIsLoggingOut(true);
    try {
      if (await logout()) {
        setIsLogoutDialogOpen(false);
        router.replace('/(auth)/login');
      }
    } catch (error) {
      console.error('Logout failed:', error);
      Alert.alert('Unable to log out', 'Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const claimOlderReports = async () => {
    if (!user?.id || isRecoveringOfflineData) return;
    setIsRecoveringOfflineData(true);
    try {
      claimUnassignedLocalData(user.id);
      setUnclaimedDisposition('claimed');
      setOfflineCounts({
        accountPending: getPendingSyncCount(user.id),
        accountFailed: getFailedSyncCount(user.id),
        unclaimed: getUnclaimedPendingOutboxCount(),
      });
      await syncPendingLocalData(user.id);
      setOfflineCounts({
        accountPending: getPendingSyncCount(user.id),
        accountFailed: getFailedSyncCount(user.id),
        unclaimed: getUnclaimedPendingOutboxCount(),
      });
    } catch (error) {
      console.error('Could not recover older offline reports:', error);
      Alert.alert('Reports remain saved', 'The older reports were not removed. Try recovery again while signed in to the account that created them.');
    } finally {
      setIsRecoveringOfflineData(false);
    }
  };

  return (
    <ThemeAwareSafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <ThemeAwareScrollView
        style={{ backgroundColor: palette.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={[Colors.primary, Colors.brandBlueDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <ThemeAwareView style={styles.heroDecoration} />
          <ThemeAwareView style={styles.heroTop}>
            <AppBackArrow />
            <Text style={styles.eyebrow}>YOUR HANDA SPACE</Text>
          </ThemeAwareView>
          <Text style={styles.heroTitle}>More</Text>
          <Text style={styles.heroSubtitle}>Your profile, preferences, and support.</Text>
          <ThemeAwareView style={[styles.profileCard, { backgroundColor: palette.surface }]}>
            <Avatar uri={user?.profilePicture} name={displayName} size={58} />
            <ThemeAwareView style={styles.profileCopy}>
              <Text numberOfLines={1} style={[styles.name, { color: palette.text }]}>{displayName}</Text>
              <ThemeAwareView style={styles.roleRow}>
                <MaterialCommunityIcons name={roleLabel === 'Responder' ? 'shield-check' : 'account-heart-outline'} size={15} color="#D45B92" />
                <Text style={styles.role}>{roleLabel}</Text>
              </ThemeAwareView>
            </ThemeAwareView>
          </ThemeAwareView>
        </LinearGradient>

        <ThemeAwareView style={styles.sectionHeading}>
          <ThemeAwareView>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Quick access</Text>
            <Text style={[styles.sectionCaption, { color: palette.textMuted }]}>Everything you need, in one place</Text>
          </ThemeAwareView>
          <ThemeAwareView style={styles.sectionIcon}>
            <MaterialCommunityIcons name="view-grid-outline" size={18} color="#D45B92" />
          </ThemeAwareView>
        </ThemeAwareView>

        <ThemeAwareView style={styles.menu}>
          {menuItems.map((item, index) => (
            <Reveal key={item.title} index={index}>
              <AnimatedPressable
                style={[styles.menuButton, { backgroundColor: palette.surface, borderColor: palette.border }]}
                onPress={item.onPress}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${item.description}`}
              >
                <ThemeAwareView style={styles.menuIcon}>
                  {item.mascot
                    ? <RescueMascot size={38} />
                    : <MaterialCommunityIcons name={item.icon ?? 'help-circle-outline'} size={23} color="#D45B92" />}
                </ThemeAwareView>
                <ThemeAwareView style={styles.menuCopy}>
                  <Text style={[styles.menuLabel, { color: palette.text }]}>{item.title}</Text>
                  <Text style={[styles.menuDescription, { color: palette.textMuted }]}>{item.description}</Text>
                </ThemeAwareView>
                <MaterialCommunityIcons name="chevron-right" size={21} color={palette.textMuted} />
              </AnimatedPressable>
            </Reveal>
          ))}
        </ThemeAwareView>

        <Reveal index={4}>
          <AnimatedPressable
            style={[styles.logoutButton, { backgroundColor: palette.surface, borderColor: palette.border }]}
            onPress={() => setIsLogoutDialogOpen(true)}
            accessibilityRole="button"
          >
            <ThemeAwareView style={styles.logoutIcon}>
              <MaterialCommunityIcons name="logout" size={20} color={Colors.emergency} />
            </ThemeAwareView>
            <ThemeAwareView style={styles.menuCopy}>
              <Text style={styles.logoutLabel}>Log out</Text>
              <Text style={[styles.menuDescription, { color: palette.textMuted }]}>Sign out of this device</Text>
            </ThemeAwareView>
            <MaterialCommunityIcons name="chevron-right" size={21} color={palette.textMuted} />
          </AnimatedPressable>
        </Reveal>
        <Text style={[styles.footer, { color: palette.textMuted }]}>HANDA - Here to help keep you safe</Text>
      </ThemeAwareScrollView>

      <Modal visible={isLogoutDialogOpen} transparent animationType="fade" onRequestClose={() => setIsLogoutDialogOpen(false)}>
        <ThemeAwarePressable style={styles.modalBackdrop} onPress={() => !isLoggingOut && setIsLogoutDialogOpen(false)}>
          <ThemeAwarePressable
            style={[styles.logoutDialog, { backgroundColor: palette.surface }]}
            onPress={(event) => event.stopPropagation()}
          >
            <ThemeAwareView style={styles.dialogIcon}>
              <MaterialCommunityIcons name="logout" size={23} color={Colors.emergency} />
            </ThemeAwareView>
            <Text style={[styles.dialogTitle, { color: palette.text }]}>Log out?</Text>
            <Text style={[styles.dialogMessage, { color: palette.textMuted }]}>Are you sure you want to log out of your account?</Text>
            {offlineCounts.accountPending > 0 && <Text style={[styles.offlineWarning, { color: palette.textMuted }]}>
              {offlineCounts.accountPending} report(s) are waiting to sync for this account. They will remain on this device and retry when you sign back in. Logging out will not erase them.
            </Text>}
            {offlineCounts.accountFailed > 0 && <Text style={[styles.offlineWarning, { color: palette.textMuted }]}>
              {offlineCounts.accountFailed} report(s) were rejected by the server and need follow-up before they can sync. Their local copies remain saved; logging out will not erase them.
            </Text>}
            {offlineCounts.unclaimed > 0 && <ThemeAwareView style={[styles.legacyWarning, { borderColor: palette.border }]}>
              <Text style={[styles.offlineWarning, { color: palette.textMuted }]}>
                {offlineCounts.unclaimed} older unsynced report(s) have no account owner. They stay on this device and will not sync automatically.
              </Text>
              {unclaimedDisposition === 'unresolved' ? <>
                <AnimatedPressable
                  style={[styles.recoveryButton, { borderColor: palette.border }]}
                  onPress={() => void claimOlderReports()}
                  disabled={isRecoveringOfflineData}
                  accessibilityRole="button"
                >
                  {isRecoveringOfflineData
                    ? <ActivityIndicator size="small" color={Colors.primary} />
                    : <Text style={[styles.recoveryButtonText, { color: palette.text }]}>Claim for {displayName} and sync</Text>}
                </AnimatedPressable>
                <AnimatedPressable
                  style={styles.keepButton}
                  onPress={() => setUnclaimedDisposition('kept')}
                  disabled={isRecoveringOfflineData}
                  accessibilityRole="button"
                >
                  <Text style={styles.keepButtonText}>Keep unclaimed on this device</Text>
                </AnimatedPressable>
              </> : <Text style={[styles.offlineDisposition, { color: palette.textMuted }]}>
                {unclaimedDisposition === 'claimed'
                  ? 'Older reports are now assigned to this account and will retry syncing when possible.'
                  : 'Older reports will remain unassigned on this device for later recovery.'}
              </Text>}
            </ThemeAwareView>}
            <ThemeAwareView style={styles.dialogActions}>
              <AnimatedPressable
                style={[styles.cancelButton, { borderColor: palette.border }]}
                onPress={() => { setIsLogoutDialogOpen(false); setUnclaimedDisposition('unresolved'); }}
                disabled={isLoggingOut || isRecoveringOfflineData}
                accessibilityRole="button"
              >
                <Text style={[styles.cancelButtonText, { color: palette.text }]}>Cancel</Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={styles.confirmButton}
                onPress={() => void handleLogout()}
                disabled={!offlineCountsLoaded || isLoggingOut || isRecoveringOfflineData || (offlineCounts.unclaimed > 0 && unclaimedDisposition === 'unresolved')}
                accessibilityRole="button"
              >
                {isLoggingOut ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.confirmButtonText}>Log out</Text>}
              </AnimatedPressable>
            </ThemeAwareView>
          </ThemeAwarePressable>
        </ThemeAwarePressable>
      </Modal>
    </ThemeAwareSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: 26 },
  hero: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 20, overflow: 'hidden' },
  heroDecoration: { position: 'absolute', width: 210, height: 210, borderRadius: 105, right: -85, top: -110, backgroundColor: 'rgba(255,255,255,0.09)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  eyebrow: { color: 'rgba(255,255,255,0.76)', fontFamily: kitFonts.bold, fontSize: 10, letterSpacing: 1.8 },
  heroTitle: { color: Colors.white, fontFamily: kitFonts.heading, fontSize: 34, marginTop: 5 },
  heroSubtitle: { color: 'rgba(255,255,255,0.82)', fontFamily: kitFonts.medium, fontSize: 14, marginTop: 2 },
  profileCard: { flexDirection: 'row', alignItems: 'center', padding: 14, marginTop: 22, borderRadius: 18, backgroundColor: '#FFFFFF' },
  profileCopy: { flex: 1, marginLeft: 13, marginRight: 8 },
  name: { fontFamily: kitFonts.bold, fontSize: 17 },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  role: { color: '#D45B92', fontFamily: kitFonts.semibold, fontSize: 12 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, marginTop: 25, marginBottom: 13 },
  sectionTitle: { fontFamily: kitFonts.heading, fontSize: 19 },
  sectionCaption: { fontFamily: kitFonts.medium, fontSize: 12, marginTop: 3 },
  sectionIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(33,139,37,0.1)', alignItems: 'center', justifyContent: 'center' },
  menu: { paddingHorizontal: 16, gap: 10 },
  menuButton: { minHeight: 76, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1, borderRadius: 16 },
  menuIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: 'rgba(33,139,37,0.1)' },
  menuCopy: { flex: 1, marginLeft: 13 },
  menuLabel: { fontFamily: kitFonts.semibold, fontSize: 15 },
  menuDescription: { fontFamily: kitFonts.medium, fontSize: 11, lineHeight: 16, marginTop: 3 },
  logoutButton: { minHeight: 74, flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 16, paddingHorizontal: 13, borderWidth: 1, borderRadius: 16 },
  logoutIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: 'rgba(217,45,32,0.1)' },
  logoutLabel: { color: Colors.emergency, fontFamily: kitFonts.semibold, fontSize: 15 },
  footer: { textAlign: 'center', fontFamily: kitFonts.medium, fontSize: 11, marginTop: 25, paddingHorizontal: 16 },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.48)' },
  logoutDialog: { width: '100%', maxWidth: 360, padding: 22, borderRadius: 20 },
  dialogIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: 'rgba(217,45,32,0.1)', marginBottom: 15 },
  dialogTitle: { fontFamily: kitFonts.heading, fontSize: 20 },
  dialogMessage: { fontFamily: kitFonts.medium, fontSize: 14, lineHeight: 21, marginTop: 7 },
  offlineWarning: { fontFamily: kitFonts.medium, fontSize: 12, lineHeight: 18, marginTop: 12 },
  legacyWarning: { marginTop: 12, padding: 12, borderWidth: 1, borderRadius: 12 },
  recoveryButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, marginTop: 10, borderWidth: 1, borderRadius: 10 },
  recoveryButtonText: { fontFamily: kitFonts.semibold, fontSize: 12 },
  keepButton: { minHeight: 38, alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  keepButtonText: { color: Colors.primary, fontFamily: kitFonts.semibold, fontSize: 12 },
  offlineDisposition: { fontFamily: kitFonts.medium, fontSize: 11, lineHeight: 16, marginTop: 8 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 22 },
  cancelButton: { minWidth: 88, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderRadius: 12 },
  cancelButtonText: { fontFamily: kitFonts.semibold, fontSize: 14 },
  confirmButton: { minWidth: 96, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, backgroundColor: Colors.emergency },
  confirmButtonText: { color: Colors.white, fontFamily: kitFonts.bold, fontSize: 14 },
});
