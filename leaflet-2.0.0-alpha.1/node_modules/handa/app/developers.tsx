import React from 'react';
import { Linking, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable } from '@components/Buttons';
import AppBackArrow from '@components/AppBackArrow';
import { Colors } from '@constants/colors';
import { useTheme } from '@hooks/useTheme';

const GREEN = '#218B25';
const CONTACT_EMAIL = 'handadevs@gmail.com';

const DEVELOPERS = [
  { name: 'Jullian Maxxi B. Sabando', roles: ['Project Manager', 'Full Stack Developer'] },
  { name: 'Jan Daniel M. Nieto', roles: ['Frontend Developer'] },
  { name: 'Angel Jmie N. Labre', roles: ['UI/UX Designer', 'Documentation', 'Researcher'] },
  { name: 'Jhari Clark C. Santos', roles: ['Documentation Lead', 'Lead Researcher'] },
  { name: 'Lance Andrei M. Salas', roles: ['QA Tester', 'Researcher'] },
];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export default function DevelopersScreen() {
  const { palette } = useTheme();
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <AppBackArrow />
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>MORE</Text>
          <Text style={styles.title} numberOfLines={2}>Developer details</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <MaterialCommunityIcons name="school-outline" size={34} color={GREEN} />
          <Text style={[styles.school, { color: palette.text }]}>Polytechnic University of the Philippines</Text>
          <Text style={[styles.campus, { color: palette.text }]}>Biñan Campus</Text>
          <Text style={[styles.program, { color: palette.textMuted }]}>Bachelor of Science in Information Technology</Text>
        </View>

        <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>DEVELOPMENT TEAM</Text>
        {DEVELOPERS.map((developer) => (
          <View key={developer.name} style={[styles.member, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials(developer.name)}</Text></View>
            <View style={styles.memberCopy}>
              <Text style={[styles.memberName, { color: palette.text }]}>{developer.name}</Text>
              {developer.roles.map((role) => <Text key={role} style={styles.role}>{role}</Text>)}
            </View>
          </View>
        ))}

        <AnimatedPressable
          style={[styles.contact, { backgroundColor: palette.surface, borderColor: GREEN }]}
          onPress={() => void Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
          accessibilityRole="link"
          accessibilityLabel={`Email ${CONTACT_EMAIL}`}
        >
          <MaterialCommunityIcons name="email-outline" size={26} color={GREEN} />
          <View style={styles.memberCopy}>
            <Text style={[styles.contactLabel, { color: palette.textMuted }]}>Contact us</Text>
            <Text style={styles.contactEmail}>{CONTACT_EMAIL}</Text>
          </View>
        </AnimatedPressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 18, backgroundColor: GREEN, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: Colors.white, fontSize: 11, letterSpacing: 1, opacity: 0.85 },
  title: { marginTop: 2, color: Colors.white, fontSize: 25, fontWeight: '800', flexShrink: 1 },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 16, paddingBottom: 32, gap: 12 },
  card: { alignItems: 'center', padding: 20, borderWidth: 1, borderRadius: 8, gap: 4 },
  school: { fontSize: 17, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  campus: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  program: { fontSize: 13, textAlign: 'center', marginTop: 4 },
  sectionLabel: { marginTop: 6, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderWidth: 1, borderRadius: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCEBDD' },
  avatarText: { color: GREEN, fontSize: 16, fontWeight: '800' },
  memberCopy: { flex: 1, minWidth: 0 },
  memberName: { fontSize: 16, fontWeight: '800' },
  role: { color: GREEN, fontSize: 13, marginTop: 2 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderWidth: 1, borderRadius: 8, marginTop: 6 },
  contactLabel: { fontSize: 12 },
  contactEmail: { color: GREEN, fontSize: 16, fontWeight: '800' },
});
