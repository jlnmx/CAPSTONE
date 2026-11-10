import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable } from '@components/Buttons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@constants/colors';
import { HandaLogoBadge } from '@components/HandaLogo';
import { GradientHeader, kitFonts, Reveal } from '@components/ScreenKit';

export default function RegistrationRoleScreen() {
  const router = useRouter();

  const openRegistration = (role: 'Resident' | 'Responder') => {
    if (role === 'Responder') {
      router.push({ pathname: '/(auth)/register-responder', params: { responderType: 'Official' } });
      return;
    }
    router.push('/(auth)/register');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <GradientHeader title="Create your account" subtitle="Choose how you will use HANDA" icon="account-plus-outline" />
          <View style={styles.cardBody}>
            <View style={styles.intro}>
              <HandaLogoBadge size={48} />
              <View style={styles.introCopy}>
                <Text style={styles.eyebrow}>WELCOME TO HANDA</Text>
                <Text style={styles.title}>Choose your role</Text>
                <Text style={styles.subtitle}>Select the account type that best describes you.</Text>
              </View>
            </View>

            <View style={styles.options}>
              <Reveal index={0}>
                <RegistrationOption
                  icon="home-account"
                  title="Resident"
                  description="Receive local alerts, report incidents, and keep your household information ready."
                  onPress={() => openRegistration('Resident')}
                  accent="#1769AA"
                  tag="COMMUNITY"
                />
              </Reveal>
              <Text style={styles.groupLabel}>RESPONDER APPLICATION</Text>
              <Reveal index={1}>
                <RegistrationOption
                  icon="shield-account-outline"
                  title="Official responder"
                  description="For authorized emergency-response personnel. An official ID is required."
                  onPress={() => openRegistration('Responder')}
                  accent="#218B25"
                  tag="VERIFICATION REQUIRED"
                />
              </Reveal>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function RegistrationOption({ icon, title, description, onPress, accent, tag }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; title: string; description: string; onPress: () => void; accent: string; tag: string }) {
  return (
    <AnimatedPressable style={styles.option} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${description}`}>
      <View style={[styles.optionIcon, { backgroundColor: `${accent}12` }]}>
        <MaterialCommunityIcons name={icon} size={24} color={accent} />
      </View>
      <View style={styles.optionCopy}>
        <Text style={[styles.optionTag, { color: accent }]}>{tag}</Text>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionDescription}>{description}</Text>
      </View>
      <View style={styles.optionArrow}><MaterialCommunityIcons name="arrow-up-right" size={19} color={accent} /></View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F1F4F2' },
  content: { flexGrow: 1, width: '100%', maxWidth: 760, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 24 },
  card: { width: '100%', maxWidth: 560, alignSelf: 'center', borderRadius: 26, overflow: 'hidden', backgroundColor: Colors.surface, borderWidth: 1, borderColor: '#E0EAE0', shadowColor: '#123A1C', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 7 },
  cardBody: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 22 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 19 },
  introCopy: { flex: 1 },
  eyebrow: { color: '#218B25', fontFamily: kitFonts.bold, fontSize: 9, letterSpacing: 1 },
  title: { color: Colors.text, fontFamily: kitFonts.heading, fontSize: 21, marginTop: 4 },
  subtitle: { color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 12, lineHeight: 18, marginTop: 3 },
  options: { gap: 11 },
  groupLabel: { color: Colors.textMuted, fontFamily: kitFonts.bold, fontSize: 9, letterSpacing: 1, marginTop: 4, marginBottom: -3 },
  option: { minHeight: 110, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#E2E9E3', borderRadius: 18, backgroundColor: '#FFFFFF', shadowColor: '#163B20', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 },
  optionIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  optionCopy: { flex: 1, minWidth: 0 },
  optionTag: { fontFamily: kitFonts.bold, fontSize: 8, letterSpacing: 0.8, marginBottom: 3 },
  optionTitle: { color: Colors.text, fontFamily: kitFonts.heading, fontSize: 15 },
  optionDescription: { color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 11, lineHeight: 16, marginTop: 4 },
  optionArrow: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#F2F6F2' },
});