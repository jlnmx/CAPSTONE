import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import RescueMascot from '@components/RescueMascot';
import { Colors } from '@constants/colors';

type TutorialRole = 'resident' | 'responder';
type TutorialStep = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  message: string;
};

const TUTORIALS: Record<TutorialRole, TutorialStep[]> = {
  resident: [
    {
      icon: 'home-heart',
      title: 'Your safety overview',
      message: 'Home brings together My Status, local weather, advisories, and quick actions. Use the bottom tabs for Incidents, SOS, Map, and More; tap the bell for Alerts.',
    },
    {
      icon: 'alert-octagon-outline',
      title: 'Report an incident or use SOS',
      message: 'Report an incident from Home with details, your location, and a photo when possible, or browse the Incidents tab. For urgent help, hold SOS for 2 seconds and call emergency services if someone is in immediate danger.',
    },
    {
      icon: 'account-group-outline',
      title: 'Household and evacuation status',
      message: 'Keep your household members up to date. If you evacuate, register your household and follow responder check-in instructions. My Status changes as responders update your registration.',
    },
    {
      icon: 'map-marker-radius-outline',
      title: 'Centers and evacuation guidance',
      message: 'Use Center Status or the Map to check locations, availability, and capacity. Evacuation Guidance and the Preparedness Guide offer practical steps before, during, and after an emergency.',
    },
    {
      icon: 'phone-in-talk-outline',
      title: 'Stay informed and ready',
      message: 'Use Emergency Contacts for local hotlines and follow official local-government and PAGASA advisories. Open More for your account, settings, and Kaya whenever you need help using HANDA.',
    },
  ],
  responder: [
    {
      icon: 'view-dashboard-outline',
      title: 'Your field overview',
      message: 'Home summarizes evacuees, active incidents, centers, and response history. Use the bottom tabs for Evacuees, Incidents, Map, and More; weather and disaster cards flag changing conditions.',
    },
    {
      icon: 'alert-outline',
      title: 'Review and respond to incidents',
      message: 'In Incidents, review reports and acknowledge when you can respond. Record your ETA, team, and notes; update the status as work progresses. A scene photo can record your arrival and location.',
    },
    {
      icon: 'account-multiple-check-outline',
      title: 'Evacuees and check-ins',
      message: 'Use Total Evacuees to find registrations, filter by center or status, and verify or update check-ins. Confirm details carefully so household records stay accurate.',
    },
    {
      icon: 'map-marker-radius-outline',
      title: 'Map and evacuation centers',
      message: 'The live map shows incident locations and centers. Check center occupancy, capacity, and availability before guiding residents; use the map details to navigate to a response location.',
    },
    {
      icon: 'clipboard-text-clock-outline',
      title: 'History, alerts, and support',
      message: 'Response History keeps incident timelines, arrival details, and outcomes. Watch notifications for updates; More has your account, settings, and Kaya for HANDA help. Follow official emergency instructions.',
    },
  ],
};

interface QuickTutorialProps {
  role: TutorialRole;
  userId?: string;
}

export default function QuickTutorial({ role, userId }: QuickTutorialProps) {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const storageKey = userId ? `handa.quickTutorial.${role}.${userId}` : null;
  const steps = TUTORIALS[role];
  const step = steps[currentStep];

  useEffect(() => {
    let active = true;
    setVisible(false);
    setCurrentStep(0);

    if (!storageKey) return () => { active = false; };

    void AsyncStorage.getItem(storageKey)
      .then((completed) => {
        if (active) setVisible(completed !== 'completed');
      })
      .catch((error: unknown) => {
        console.error('Could not read HANDA tutorial status:', error);
        if (active) setVisible(true);
      });

    return () => { active = false; };
  }, [storageKey]);

  const finishTutorial = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (storageKey) await AsyncStorage.setItem(storageKey, 'completed');
      setVisible(false);
    } catch (error) {
      console.error('Could not save HANDA tutorial status:', error);
      Alert.alert('Tutorial not saved', 'You can continue using HANDA, but Kaya’s tutorial may appear again next time.');
      setVisible(false);
    } finally {
      setIsSaving(false);
    }
  };

  const goNext = () => {
    if (currentStep === steps.length - 1) {
      void finishTutorial();
      return;
    }
    setCurrentStep((index) => Math.min(index + 1, steps.length - 1));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => void finishTutorial()}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <RescueMascot size={58} animated />
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>MEET YOUR HANDA GUIDE</Text>
              <Text style={styles.kaya}>Hi, I’m Kaya!</Text>
              <Text style={styles.headerSubtitle}>Let me show you around.</Text>
            </View>
          </View>

          <View style={styles.progressRow}>
            <Text style={styles.stepCount}>STEP {currentStep + 1} OF {steps.length}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${((currentStep + 1) / steps.length) * 100}%` }]} />
            </View>
          </View>

          <ScrollView style={styles.stepContent} contentContainerStyle={styles.stepContentInner} showsVerticalScrollIndicator={false}>
            <View style={styles.stepIcon}>
              <MaterialCommunityIcons name={step.icon} size={25} color={Colors.primary} />
            </View>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <View style={styles.speechBubble}>
              <Text style={styles.message}>{step.message}</Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={() => void finishTutorial()} disabled={isSaving} accessibilityRole="button" accessibilityLabel="Skip tutorial">
              <Text style={[styles.skip, isSaving && styles.disabled]}>Skip tour</Text>
            </Pressable>
            <View style={styles.navigation}>
              {currentStep > 0 && (
                <Pressable onPress={() => setCurrentStep((index) => Math.max(index - 1, 0))} disabled={isSaving} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Previous tutorial step">
                  <MaterialCommunityIcons name="chevron-left" size={20} color={Colors.text} />
                  <Text style={styles.backText}>Back</Text>
                </Pressable>
              )}
              <Pressable onPress={goNext} disabled={isSaving} style={[styles.nextButton, isSaving && styles.disabledButton]} accessibilityRole="button" accessibilityLabel={currentStep === steps.length - 1 ? 'Finish tutorial' : 'Next tutorial step'}>
                <Text style={styles.nextText}>{currentStep === steps.length - 1 ? 'Let’s go' : 'Next'}</Text>
                {currentStep < steps.length - 1 && <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.white} />}
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 18, backgroundColor: 'rgba(20, 26, 34, 0.62)' },
  card: { width: '100%', maxWidth: 430, maxHeight: '92%', padding: 20, borderRadius: 24, backgroundColor: Colors.surface, shadowColor: '#182230', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerCopy: { flex: 1 },
  eyebrow: { color: Colors.brandBlueDeep, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  kaya: { marginTop: 3, color: Colors.primary, fontSize: 22, fontWeight: '900' },
  headerSubtitle: { marginTop: 2, color: Colors.textMuted, fontSize: 12 },
  progressRow: { marginTop: 15 },
  stepCount: { color: Colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.9 },
  progressTrack: { height: 5, marginTop: 7, overflow: 'hidden', borderRadius: 99, backgroundColor: '#F1C7D9' },
  progressFill: { height: '100%', borderRadius: 99, backgroundColor: Colors.primary },
  stepContent: { flexShrink: 1, marginTop: 18 },
  stepContentInner: { paddingBottom: 8 },
  stepIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#FFF1F6' },
  stepTitle: { marginTop: 13, color: Colors.text, fontSize: 19, lineHeight: 25, fontWeight: '800' },
  speechBubble: { marginTop: 10, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: '#F1C7D9', borderRadius: 17, borderTopLeftRadius: 4, backgroundColor: '#FFF8FB' },
  message: { color: Colors.text, fontSize: 13, lineHeight: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 15, paddingTop: 13, borderTopWidth: 1, borderTopColor: Colors.border },
  skip: { paddingVertical: 10, color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
  navigation: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderRadius: 12 },
  backText: { color: Colors.text, fontSize: 12, fontWeight: '700' },
  nextButton: { minHeight: 44, minWidth: 94, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 15, borderRadius: 13, backgroundColor: Colors.primary },
  nextText: { color: Colors.white, fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  disabledButton: { opacity: 0.55 },
});
