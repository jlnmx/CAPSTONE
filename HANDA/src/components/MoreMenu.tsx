import React, { useState } from 'react';
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
import { useAuth } from '@hooks/useAuth';
import { useTheme } from '@hooks/useTheme';

interface MoreMenuProps {
  roleLabel: string;
}

type MenuItem = {
  title: string;
  description: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress: () => void;
};

export function MoreMenu({ roleLabel }: MoreMenuProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { palette } = useTheme();
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const displayName = user?.name || 'HANDA User';

  const menuItems: MenuItem[] = [
    { title: 'Settings', description: 'Personalize your app experience', icon: 'cog-outline', onPress: () => router.push('/settings') },
    { title: 'Account', description: 'Manage your profile and details', icon: 'account-outline', onPress: () => router.push('/account') },
    {
      title: 'HANDA Support',
      description: 'Get help with preparedness and response',
      icon: 'lifebuoy',
      onPress: () => router.push(roleLabel === 'Resident' ? '/(resident)/chatbot' : '/(responder)/chatbot'),
    },
    { title: 'Developer details', description: 'Learn about the team behind HANDA', icon: 'code-braces', onPress: () => router.push('/developers') },
  ];

  const handleLogout = async () => {
    if (isLoggingOut) return;
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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <ScrollView
        style={{ backgroundColor: palette.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={['#218B25', '#176B1D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroDecoration} />
          <View style={styles.heroTop}>
            <AppBackArrow />
            <Text style={styles.eyebrow}>YOUR HANDA SPACE</Text>
          </View>
          <Text style={styles.heroTitle}>More</Text>
          <Text style={styles.heroSubtitle}>Your profile, preferences, and support.</Text>
          <View style={[styles.profileCard, { backgroundColor: palette.surface }]}>
            <Avatar uri={user?.profilePicture} name={displayName} size={58} />
            <View style={styles.profileCopy}>
              <Text numberOfLines={1} style={[styles.name, { color: palette.text }]}>{displayName}</Text>
              <View style={styles.roleRow}>
                <MaterialCommunityIcons name={roleLabel === 'Responder' ? 'shield-check' : 'account-heart-outline'} size={15} color="#218B25" />
                <Text style={styles.role}>{roleLabel}</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={23} color={palette.textMuted} />
          </View>
        </LinearGradient>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Quick access</Text>
            <Text style={[styles.sectionCaption, { color: palette.textMuted }]}>Everything you need, in one place</Text>
          </View>
          <View style={styles.sectionIcon}>
            <MaterialCommunityIcons name="view-grid-outline" size={18} color="#218B25" />
          </View>
        </View>

        <View style={styles.menu}>
          {menuItems.map((item, index) => (
            <Reveal key={item.title} index={index}>
              <AnimatedPressable
                style={[styles.menuButton, { backgroundColor: palette.surface, borderColor: palette.border }]}
                onPress={item.onPress}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${item.description}`}
              >
                <View style={styles.menuIcon}>
                  <MaterialCommunityIcons name={item.icon} size={23} color="#218B25" />
                </View>
                <View style={styles.menuCopy}>
                  <Text style={[styles.menuLabel, { color: palette.text }]}>{item.title}</Text>
                  <Text style={[styles.menuDescription, { color: palette.textMuted }]}>{item.description}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={21} color={palette.textMuted} />
              </AnimatedPressable>
            </Reveal>
          ))}
        </View>

        <Reveal index={4}>
          <AnimatedPressable
            style={[styles.logoutButton, { backgroundColor: palette.surface, borderColor: palette.border }]}
            onPress={() => setIsLogoutDialogOpen(true)}
            accessibilityRole="button"
          >
            <View style={styles.logoutIcon}>
              <MaterialCommunityIcons name="logout" size={20} color={Colors.emergency} />
            </View>
            <View style={styles.menuCopy}>
              <Text style={styles.logoutLabel}>Log out</Text>
              <Text style={[styles.menuDescription, { color: palette.textMuted }]}>Sign out of this device</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={21} color={palette.textMuted} />
          </AnimatedPressable>
        </Reveal>
        <Text style={[styles.footer, { color: palette.textMuted }]}>HANDA - Here to help keep you safe</Text>
      </ScrollView>

      <Modal visible={isLogoutDialogOpen} transparent animationType="fade" onRequestClose={() => setIsLogoutDialogOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => !isLoggingOut && setIsLogoutDialogOpen(false)}>
          <Pressable
            style={[styles.logoutDialog, { backgroundColor: palette.surface }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.dialogIcon}>
              <MaterialCommunityIcons name="logout" size={23} color={Colors.emergency} />
            </View>
            <Text style={[styles.dialogTitle, { color: palette.text }]}>Log out?</Text>
            <Text style={[styles.dialogMessage, { color: palette.textMuted }]}>Are you sure you want to log out of your account?</Text>
            <View style={styles.dialogActions}>
              <AnimatedPressable
                style={[styles.cancelButton, { borderColor: palette.border }]}
                onPress={() => setIsLogoutDialogOpen(false)}
                disabled={isLoggingOut}
                accessibilityRole="button"
              >
                <Text style={[styles.cancelButtonText, { color: palette.text }]}>Cancel</Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={styles.confirmButton}
                onPress={() => void handleLogout()}
                disabled={isLoggingOut}
                accessibilityRole="button"
              >
                {isLoggingOut ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.confirmButtonText}>Log out</Text>}
              </AnimatedPressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
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
  role: { color: '#218B25', fontFamily: kitFonts.semibold, fontSize: 12 },
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
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 22 },
  cancelButton: { minWidth: 88, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderRadius: 12 },
  cancelButtonText: { fontFamily: kitFonts.semibold, fontSize: 14 },
  confirmButton: { minWidth: 96, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, backgroundColor: Colors.emergency },
  confirmButtonText: { color: Colors.white, fontFamily: kitFonts.bold, fontSize: 14 },
});
