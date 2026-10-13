import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable as TouchableOpacity } from '@components/Buttons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@hooks/useAuth';
import { Colors, BorderRadius, Spacing } from '@constants/colors';
import { useTheme } from '@hooks/useTheme';

interface MoreMenuProps {
  roleLabel: string;
}

export function MoreMenu({ roleLabel }: MoreMenuProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { palette } = useTheme();
  const displayName = user?.name || 'HANDA User';

  const openSettings = () => {
    router.push('/settings');
  };

  const openAccount = () => {
    router.push('/account');
  };

  const confirmLogout = () => {
    setIsLogoutDialogOpen(true);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
      setIsLogoutDialogOpen(false);
      router.replace('/(auth)/login');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <ScrollView style={[styles.container, { backgroundColor: palette.background }]} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>MORE</Text>
        </View>

        <View style={styles.profile}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="account-outline" size={42} color="#218B25" />
          </View>
          <View style={styles.profileCopy}>
            <Text style={[styles.name, { color: palette.text }]}>{displayName}</Text>
            <Text style={styles.role}>{roleLabel}</Text>
          </View>
        </View>

        <View style={styles.menu}>
          <TouchableOpacity style={[styles.menuButton, { backgroundColor: palette.surface, borderColor: palette.border }]} onPress={openSettings} activeOpacity={0.8}>
            <MaterialCommunityIcons name="cog-outline" size={46} color="#218B25" />
            <Text style={styles.menuLabel}>SETTINGS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuButton, { backgroundColor: palette.surface, borderColor: palette.border }]} onPress={openAccount} activeOpacity={0.8}>
            <MaterialCommunityIcons name="account-outline" size={46} color="#218B25" />
            <Text style={styles.menuLabel}>ACCOUNT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuButton, styles.logoutButton, { backgroundColor: palette.surface, borderColor: palette.border }]} onPress={confirmLogout} activeOpacity={0.8}>
            <MaterialCommunityIcons name="logout" size={42} color={Colors.emergency} />
            <Text style={[styles.menuLabel, styles.logoutLabel]}>LOG OUT</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={isLogoutDialogOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLogoutDialogOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsLogoutDialogOpen(false)}>
          <Pressable style={styles.logoutDialog} onPress={(event) => event.stopPropagation()}>
            <Text style={[styles.dialogTitle, { color: palette.text }]}>Log out?</Text>
            <Text style={[styles.dialogMessage, { color: palette.textMuted }]}>Are you sure you want to log out of your account?</Text>
            <View style={styles.dialogActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setIsLogoutDialogOpen(false)}
                disabled={isLoggingOut}
                accessibilityRole="button"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => void handleLogout()}
                disabled={isLoggingOut}
                accessibilityRole="button"
              >
                {isLoggingOut ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.confirmButtonText}>Log out</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    paddingBottom: 26,
  },
  header: {
    height: 87,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#218B25',
  },
  headerTitle: {
    color: Colors.white,
    fontSize: 31,
    fontWeight: '800',
    letterSpacing: 1,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  avatar: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#218B25',
    borderRadius: 34,
    backgroundColor: Colors.surfaceMuted,
  },
  profileCopy: {
    flex: 1,
    marginLeft: 19,
  },
  name: {
    flexShrink: 1,
    color: Colors.text,
    fontSize: 21,
    fontWeight: '800',
  },
  role: {
    color: '#218B25',
    fontSize: 13,
    marginTop: 3,
  },
  menu: {
    paddingHorizontal: 16,
    gap: 15,
  },
  menuButton: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#218B25',
    borderRadius: 4,
    backgroundColor: Colors.surface,
  },
  logoutButton: {
    borderColor: Colors.emergency,
  },
  menuLabel: {
    marginLeft: 16,
    color: Colors.text,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  logoutLabel: {
    color: Colors.emergency,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  logoutDialog: {
    width: '100%',
    maxWidth: 360,
    padding: 20,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  dialogTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  dialogMessage: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 22,
  },
  cancelButton: {
    minWidth: 88,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 5,
  },
  cancelButtonText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    minWidth: 88,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 5,
    backgroundColor: Colors.emergency,
  },
  confirmButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
