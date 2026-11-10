import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable } from '@components/Buttons';
import { GradientHeader, Reveal, kitFonts } from '@components/ScreenKit';
import { Colors } from '@constants/colors';
import { useTheme } from '@hooks/useTheme';

const GREEN = '#218B25';

export default function EvacuationGuidanceScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GradientHeader title="Evacuation guidance" subtitle="How center assignments work" icon="home-heart" />
        <Reveal index={0}>
          <View style={[styles.heroCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={styles.heroIcon}><MaterialCommunityIcons name="account-group-outline" size={30} color={GREEN} /></View>
            <Text style={[styles.heroTitle, { color: palette.text }]}>No registration needed</Text>
            <Text style={[styles.heroText, { color: palette.textMuted }]}>
              Evacuation centers and household check-ins are managed by City Social Welfare and Development personnel. You do not need to register yourself or choose a center in the app.
            </Text>
          </View>
        </Reveal>

        <Text style={[styles.sectionTitle, { color: palette.text }]}>What to do</Text>
        {[
          { icon: 'bullhorn-outline' as const, title: 'Follow responder directions', detail: 'Responders will guide residents to the appropriate center for their area.' },
          { icon: 'account-check-outline' as const, title: 'Personnel record your household', detail: 'City Social Welfare and Development staff manage evacuee and household check-in records.' },
          { icon: 'bell-alert-outline' as const, title: 'Watch for updates', detail: 'Responders will share instructions if a center is full or your destination needs to change.' },
        ].map((item, index) => (
          <Reveal key={item.title} index={index + 1}>
            <View style={[styles.stepCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <View style={styles.stepIcon}><MaterialCommunityIcons name={item.icon} size={21} color={GREEN} /></View>
              <View style={styles.stepCopy}>
                <Text style={[styles.stepTitle, { color: palette.text }]}>{item.title}</Text>
                <Text style={[styles.stepDetail, { color: palette.textMuted }]}>{item.detail}</Text>
              </View>
              <Text style={styles.stepNumber}>0{index + 1}</Text>
            </View>
          </Reveal>
        ))}

        <Reveal index={4}>
          <View style={[styles.actionCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.actionTitle, { color: palette.text }]}>Need live center information?</Text>
            <Text style={[styles.actionDetail, { color: palette.textMuted }]}>Check current availability or review the evacuation status linked to your account.</Text>
            <View style={styles.actions}>
              <AnimatedPressable style={styles.primaryButton} onPress={() => router.push('/(resident)/center-status')} accessibilityRole="button">
                <MaterialCommunityIcons name="home-city-outline" size={18} color={Colors.white} />
                <Text style={styles.primaryText}>Center status</Text>
              </AnimatedPressable>
              <AnimatedPressable style={[styles.secondaryButton, { borderColor: palette.border }]} onPress={() => router.push('/(resident)/verify-status')} accessibilityRole="button">
                <MaterialCommunityIcons name="shield-check-outline" size={18} color={GREEN} />
                <Text style={styles.secondaryText}>My status</Text>
              </AnimatedPressable>
            </View>
          </View>
        </Reveal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: 28 },
  heroCard: { alignItems: 'center', marginHorizontal: 16, marginTop: 18, padding: 21, borderWidth: 1, borderRadius: 21 },
  heroIcon: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(33,139,37,0.1)' },
  heroTitle: { fontFamily: kitFonts.heading, fontSize: 20, marginTop: 14, textAlign: 'center' },
  heroText: { maxWidth: 520, fontFamily: kitFonts.medium, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 7 },
  sectionTitle: { fontFamily: kitFonts.heading, fontSize: 17, marginTop: 24, marginHorizontal: 18, marginBottom: 11 },
  stepCard: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 9, padding: 13, borderWidth: 1, borderRadius: 17 },
  stepIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(33,139,37,0.1)' },
  stepCopy: { flex: 1 },
  stepTitle: { fontFamily: kitFonts.semibold, fontSize: 13 },
  stepDetail: { fontFamily: kitFonts.medium, fontSize: 11, lineHeight: 16, marginTop: 3 },
  stepNumber: { color: GREEN, fontFamily: kitFonts.heading, fontSize: 12, opacity: 0.7 },
  actionCard: { marginHorizontal: 16, marginTop: 9, padding: 16, borderWidth: 1, borderRadius: 19 },
  actionTitle: { fontFamily: kitFonts.heading, fontSize: 16 },
  actionDetail: { fontFamily: kitFonts.medium, fontSize: 11, lineHeight: 17, marginTop: 5 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 14 },
  primaryButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14, borderRadius: 13, backgroundColor: GREEN },
  primaryText: { color: Colors.white, fontFamily: kitFonts.bold, fontSize: 12 },
  secondaryButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14, borderWidth: 1, borderRadius: 13 },
  secondaryText: { color: GREEN, fontFamily: kitFonts.bold, fontSize: 12 },
});
