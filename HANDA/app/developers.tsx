import React from 'react';
import { Linking, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable } from '@components/Buttons';
import { GradientHeader, Reveal, kitFonts } from '@components/ScreenKit';
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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GradientHeader title="Developer details" subtitle="The people and purpose behind HANDA" icon="code-tags" />
        <Reveal index={0}>
          <View style={[styles.schoolCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={styles.schoolIcon}><MaterialCommunityIcons name="school-outline" size={25} color={GREEN} /></View>
            <Text style={[styles.school, { color: palette.text }]}>Polytechnic University of the Philippines</Text>
            <Text style={[styles.campus, { color: palette.text }]}>Biñan Campus</Text>
            <Text style={[styles.program, { color: palette.textMuted }]}>Bachelor of Science in Information Technology</Text>
          </View>
        </Reveal>

        <View style={styles.teamHeading}>
          <View>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Development team</Text>
            <Text style={[styles.sectionSubtitle, { color: palette.textMuted }]}>Built with care by our student team</Text>
          </View>
          <View style={styles.teamCount}><Text style={styles.teamCountText}>{DEVELOPERS.length}</Text></View>
        </View>
        <View style={styles.teamList}>
          {DEVELOPERS.map((developer, index) => (
            <Reveal key={developer.name} index={index + 1}>
              <View style={[styles.member, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{initials(developer.name)}</Text></View>
                <View style={styles.memberCopy}>
                  <Text style={[styles.memberName, { color: palette.text }]}>{developer.name}</Text>
                  <View style={styles.roles}>
                    {developer.roles.map((role) => (
                      <View key={role} style={styles.rolePill}><Text style={styles.role}>{role}</Text></View>
                    ))}
                  </View>
                </View>
              </View>
            </Reveal>
          ))}
        </View>

        <Reveal index={DEVELOPERS.length + 1}>
          <AnimatedPressable
            style={[styles.contact, { backgroundColor: palette.surface, borderColor: palette.border }]}
            onPress={() => void Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
            accessibilityRole="link"
            accessibilityLabel={`Email ${CONTACT_EMAIL}`}
          >
            <View style={styles.contactIcon}><MaterialCommunityIcons name="email-outline" size={21} color={GREEN} /></View>
            <View style={styles.memberCopy}>
              <Text style={[styles.contactLabel, { color: palette.textMuted }]}>Questions or feedback?</Text>
              <Text style={styles.contactEmail}>{CONTACT_EMAIL}</Text>
            </View>
            <MaterialCommunityIcons name="open-in-new" size={18} color={palette.textMuted} />
          </AnimatedPressable>
        </Reveal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: 32 },
  schoolCard: { alignItems: 'center', marginHorizontal: 16, marginTop: 18, padding: 20, borderWidth: 1, borderRadius: 20 },
  schoolIcon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(33,139,37,0.1)', marginBottom: 10 },
  school: { fontFamily: kitFonts.heading, fontSize: 16, textAlign: 'center' },
  campus: { fontFamily: kitFonts.semibold, fontSize: 14, textAlign: 'center', marginTop: 3 },
  program: { fontFamily: kitFonts.medium, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  teamHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25, marginHorizontal: 18, marginBottom: 12 },
  sectionTitle: { fontFamily: kitFonts.heading, fontSize: 18, textTransform: 'capitalize' },
  sectionSubtitle: { fontFamily: kitFonts.medium, fontSize: 11, marginTop: 3 },
  teamCount: { minWidth: 34, height: 34, paddingHorizontal: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(33,139,37,0.1)' },
  teamCountText: { color: GREEN, fontFamily: kitFonts.bold, fontSize: 13 },
  teamList: { paddingHorizontal: 16, gap: 9 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderWidth: 1, borderRadius: 17 },
  avatar: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E4F1E4' },
  avatarText: { color: GREEN, fontFamily: kitFonts.bold, fontSize: 15 },
  memberCopy: { flex: 1, minWidth: 0 },
  memberName: { fontFamily: kitFonts.semibold, fontSize: 14, lineHeight: 19 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  rolePill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(33,139,37,0.09)' },
  role: { color: GREEN, fontFamily: kitFonts.medium, fontSize: 10 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 17, padding: 14, borderWidth: 1, borderRadius: 17 },
  contactIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(33,139,37,0.1)' },
  contactLabel: { fontFamily: kitFonts.medium, fontSize: 11 },
  contactEmail: { color: GREEN, fontFamily: kitFonts.bold, fontSize: 14, marginTop: 3 },
});
