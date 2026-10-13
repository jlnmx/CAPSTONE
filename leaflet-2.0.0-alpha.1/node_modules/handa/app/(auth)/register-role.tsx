import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable } from '@components/Buttons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing } from '@constants/colors';

export default function RegistrationRoleScreen() {
  const router = useRouter();

  const openRegistration = (role: 'Resident' | 'Responder', responderType?: 'Official' | 'Volunteer') => {
    if (role === 'Responder') {
      router.push({ pathname: '/(auth)/register-responder', params: { responderType } });
      return;
    }
    router.push('/(auth)/register');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <AnimatedPressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Go back">
            <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.white} />
          </AnimatedPressable>
          <Text style={styles.eyebrow}>HANDA ACCOUNT</Text>
          <Text style={styles.title}>Choose your registration type</Text>
          <Text style={styles.subtitle}>Select how you will use HANDA.</Text>
        </View>

        <View style={styles.options}>
          <AnimatedPressable style={styles.option} onPress={() => openRegistration('Resident')} accessibilityRole="button">
            <View style={styles.optionIcon}><MaterialCommunityIcons name="home-account" size={24} color={Colors.secondary} /></View>
            <View style={styles.optionCopy}>
              <Text style={styles.optionTitle}>Resident</Text>
              <Text style={styles.optionDescription}>Receive local alerts, report incidents, and register your household for evacuation.</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.textMuted} />
          </AnimatedPressable>

          <Text style={styles.groupLabel}>RESPONDER APPLICATION</Text>
          <AnimatedPressable style={styles.option} onPress={() => openRegistration('Responder', 'Official')} accessibilityRole="button">
            <View style={styles.optionIcon}><MaterialCommunityIcons name="shield-account-outline" size={24} color={Colors.secondary} /></View>
            <View style={styles.optionCopy}>
              <Text style={styles.optionTitle}>Official responder</Text>
              <Text style={styles.optionDescription}>For authorized emergency-response personnel. An official ID is required.</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.textMuted} />
          </AnimatedPressable>

          <AnimatedPressable style={styles.option} onPress={() => openRegistration('Responder', 'Volunteer')} accessibilityRole="button">
            <View style={styles.optionIcon}><MaterialCommunityIcons name="account-heart-outline" size={24} color={Colors.secondary} /></View>
            <View style={styles.optionCopy}>
              <Text style={styles.optionTitle}>Volunteer responder</Text>
              <Text style={styles.optionDescription}>For community volunteers. Upload your volunteer ID for administrator review.</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.textMuted} />
          </AnimatedPressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surfaceMuted },
  content: { flexGrow: 1, width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: Spacing['3xl'] },
  header: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.xl, backgroundColor: '#218B25' },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  eyebrow: { color: '#DFF1DF', fontSize: 10, fontWeight: '800' },
  title: { color: Colors.white, fontSize: 27, fontWeight: '800', marginTop: 5 },
  subtitle: { color: '#E7F4E7', fontSize: 13, marginTop: 5 },
  options: { padding: Spacing.lg, gap: 10 },
  groupLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '800', marginTop: Spacing.lg },
  option: { minHeight: 96, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, backgroundColor: Colors.surface },
  optionIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: '#E8F2E8' },
  optionCopy: { flex: 1 },
  optionTitle: { color: Colors.text, fontSize: 15, fontWeight: '800' },
  optionDescription: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 4 },
});