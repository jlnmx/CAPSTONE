import React from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@hooks/useAuth';
import { Colors, BorderRadius, Spacing } from '@constants/colors';

interface MoreMenuProps {
  roleLabel: string;
}

export function MoreMenu({ roleLabel }: MoreMenuProps) {
  const { user, logout } = useAuth();
  const displayName = user?.name || 'HANDA User';

  const openSettings = () => {
    Alert.alert('Settings', 'Settings and notification preferences are available here.');
  };

  const openAccount = () => {
    Alert.alert('Account', 'Manage your profile and account preferences.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>MORE</Text>
        </View>

        <View style={styles.profile}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="account-outline" size={42} color="#218B25" />
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.role}>{roleLabel}</Text>
          </View>
        </View>

        <View style={styles.menu}>
          <TouchableOpacity style={styles.menuButton} onPress={openSettings} activeOpacity={0.8}>
            <MaterialCommunityIcons name="cog-outline" size={46} color="#218B25" />
            <Text style={styles.menuLabel}>SETTINGS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuButton} onPress={openAccount} activeOpacity={0.8}>
            <MaterialCommunityIcons name="account-outline" size={46} color="#218B25" />
            <Text style={styles.menuLabel}>ACCOUNT</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  content: {
    flexGrow: 1,
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
    backgroundColor: '#EAF3EA',
  },
  profileCopy: {
    flex: 1,
    marginLeft: 19,
  },
  name: {
    flexShrink: 1,
    color: '#155B19',
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
    backgroundColor: Colors.white,
  },
  menuLabel: {
    marginLeft: 16,
    color: '#155B19',
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
