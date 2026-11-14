import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import RescueMascot from '@components/RescueMascot';
import { Colors } from '@constants/colors';

type TutorialRole = 'resident' | 'responder';
type TutorialStep = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  target: string;
  title: string;
  message: string;
};

export type TutorialTargetRefs = Record<string, React.RefObject<View>>;

const TUTORIALS: Record<TutorialRole, TutorialStep[]> = {
  resident: [
    {
      icon: 'bell-outline',
      target: 'notifications',
      title: 'Your alerts',
      message: 'Tap the bell to check safety updates, incident notices, and other HANDA alerts.',
    },
    {
      icon: 'shield-check-outline',
      target: 'status',
      title: 'My Status',
      message: 'This tile shows your household’s latest evacuation status. Tap it to review your registration and check-in details.',
    },
    {
      icon: 'alert-octagon-outline',
      target: 'report',
      title: 'Report an incident',
      message: 'Use this button to send an incident report with its location and useful details. For immediate danger, call emergency services.',
    },
    {
      icon: 'information-outline',
      target: 'guidance',
      title: 'Evacuation Guidance',
      message: 'Open this guide for practical steps before, during, and after an evacuation.',
    },
    {
      icon: 'account-group-outline',
      target: 'household',
      title: 'Your household',
      message: 'Keep household members up to date here. If you evacuate, register your household and follow responder check-in instructions.',
    },
    {
      icon: 'home-city-outline',
      target: 'centers',
      title: 'Center status',
      message: 'Check evacuation center availability and capacity before heading out. The Map also shows center locations.',
    },
    {
      icon: 'phone-in-talk-outline',
      target: 'hotline',
      title: 'Emergency contacts',
      message: 'Open local hotline numbers here. Follow official local-government and PAGASA advisories; More has your settings and Kaya.',
    },
  ],
  responder: [
    {
      icon: 'bell-outline',
      target: 'notifications',
      title: 'Response updates',
      message: 'Tap the bell to review dispatch updates and other notifications while you are on duty.',
    },
    {
      icon: 'account-group-outline',
      target: 'evacuees',
      title: 'Total Evacuees',
      message: 'Open this tile to find registrations and verify or update resident check-ins.',
    },
    {
      icon: 'alert-outline',
      target: 'incidents',
      title: 'Active Incidents',
      message: 'Review reports, acknowledge when you can respond, and update progress. The Map tab shows incident locations.',
    },
    {
      icon: 'home-city-outline',
      target: 'centers',
      title: 'Evacuation Centers',
      message: 'Check occupancy, capacity, and availability before guiding residents to a center.',
    },
    {
      icon: 'history',
      target: 'history',
      title: 'Response History',
      message: 'Review incident timelines, arrival details, and outcomes. More includes your account, settings, and Kaya.',
    },
    {
      icon: 'weather-partly-cloudy',
      target: 'weather',
      title: 'Weather and advisories',
      message: 'Check current conditions and changing hazards before and during a response. Follow official emergency instructions.',
    },
  ],
};

interface QuickTutorialProps {
  role: TutorialRole;
  userId?: string;
  targets: TutorialTargetRefs;
  scrollRef: React.RefObject<ScrollView>;
  scrollOffsetRef: React.MutableRefObject<number>;
}

interface SpotlightFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OverlayFrame {
  screenX: number;
  screenY: number;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export default function QuickTutorial({ role, userId, targets, scrollRef, scrollOffsetRef }: QuickTutorialProps) {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [overlayFrame, setOverlayFrame] = useState<OverlayFrame | null>(null);
  const [spotlight, setSpotlight] = useState<SpotlightFrame | null>(null);
  const [cardHeight, setCardHeight] = useState(0);
  const [overlayReady, setOverlayReady] = useState(false);
  const overlayRef = useRef<View>(null);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const storageKey = userId ? `handa.quickTutorial.v2.${role}.${userId}` : null;
  const progressKey = storageKey ? `${storageKey}.progress` : null;
  const steps = TUTORIALS[role];
  const step = steps[currentStep];

  useEffect(() => {
    let active = true;
    setVisible(false);
    setCurrentStep(0);
    setSpotlight(null);
    setIsSaving(false);

    if (!storageKey || !progressKey) return () => { active = false; };

    void Promise.all([AsyncStorage.getItem(storageKey), AsyncStorage.getItem(progressKey)])
      .then(([completed, progress]) => {
        if (!active) return;
        if (completed === 'completed') {
          setVisible(false);
          return;
        }
        const savedStep = Number.parseInt(progress ?? '0', 10);
        setCurrentStep(Number.isFinite(savedStep) ? clamp(savedStep, 0, steps.length - 1) : 0);
        setVisible(true);
      })
      .catch((error: unknown) => {
        console.error('Could not read HANDA tutorial status:', error);
        if (active) setVisible(true);
      });

    return () => { active = false; };
  }, [progressKey, steps.length, storageKey]);

  useEffect(() => {
    if (!visible || !progressKey) return;
    void AsyncStorage.setItem(progressKey, String(currentStep))
      .catch((error: unknown) => console.error('Could not save HANDA tutorial progress:', error));
  }, [currentStep, progressKey, visible]);

  useEffect(() => {
    if (!visible || !overlayReady || !step) return undefined;
    let active = true;
    let scrollTimer: ReturnType<typeof setTimeout> | undefined;
    let scrollAttempts = 0;
    setSpotlight(null);

    const measure = () => {
      const target = targetsRef.current[step.target]?.current;
      if (!target || !overlayRef.current) return;

      overlayRef.current.measureInWindow((screenX, screenY, width, height) => {
        if (!active) return;
        setOverlayFrame({ screenX, screenY, width, height });
        target.measureInWindow((targetX, targetY, targetWidth, targetHeight) => {
          if (!active || targetWidth <= 0 || targetHeight <= 0) return;
          const localY = targetY - screenY;
          const targetBottom = localY + targetHeight;
          const overflowTop = Math.max(0, 18 - localY);
          const overflowBottom = Math.max(0, targetBottom - (height - 210));
          const scrollDelta = overflowBottom > 0 ? overflowBottom : -overflowTop;

          if (scrollDelta !== 0 && scrollAttempts < 2 && scrollRef.current) {
            scrollAttempts += 1;
            const nextOffset = Math.max(0, scrollOffsetRef.current + scrollDelta);
            scrollRef.current.scrollTo({ y: nextOffset, animated: true });
            scrollTimer = setTimeout(measure, 420);
            return;
          }

          setSpotlight({
            x: targetX - screenX - 8,
            y: localY - 8,
            width: targetWidth + 16,
            height: targetHeight + 16,
          });
        });
      });
    };

    const frame = requestAnimationFrame(measure);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, [currentStep, overlayReady, scrollOffsetRef, scrollRef, step, visible]);

  const finishTutorial = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (storageKey) {
        await AsyncStorage.setItem(storageKey, 'completed');
        if (progressKey) await AsyncStorage.removeItem(progressKey);
      }
      setVisible(false);
    } catch (error) {
      console.error('Could not save HANDA tutorial status:', error);
      Alert.alert('Tutorial not saved', 'You can continue using HANDA, but Kaya’s tutorial may appear again next time.');
      setVisible(false);
    } finally {
      setIsSaving(false);
    }
  };

  const changeStep = (nextStep: number) => {
    const boundedStep = clamp(nextStep, 0, steps.length - 1);
    setCurrentStep(boundedStep);
    if (progressKey) {
      void AsyncStorage.setItem(progressKey, String(boundedStep))
        .catch((error: unknown) => console.error('Could not save HANDA tutorial progress:', error));
    }
  };

  const goNext = () => {
    if (currentStep === steps.length - 1) {
      void finishTutorial();
      return;
    }
    changeStep(currentStep + 1);
  };

  if (!visible) return null;
  if (!overlayFrame || !spotlight) {
    return (
      <View
        ref={overlayRef}
        collapsable={false}
        pointerEvents="none"
        style={styles.overlay}
        onLayout={() => setOverlayReady(true)}
      />
    );
  }

  const cardWidth = Math.min(390, overlayFrame.width - 32);
  const fittedCardHeight = Math.min(cardHeight || 250, overlayFrame.height - 24);
  const roomAbove = spotlight.y;
  const roomBelow = overlayFrame.height - (spotlight.y + spotlight.height);
  const placeAbove = roomAbove >= fittedCardHeight + 28 || roomAbove > roomBelow;
  const desiredTop = placeAbove
    ? spotlight.y - fittedCardHeight - 28
    : spotlight.y + spotlight.height + 28;
  const cardTop = clamp(desiredTop, 12, Math.max(12, overlayFrame.height - fittedCardHeight - 12));
  const cardLeft = Math.max(16, (overlayFrame.width - cardWidth) / 2);
  const pointerLeft = clamp(
    spotlight.x + spotlight.width / 2 - 14,
    cardLeft + 16,
    cardLeft + cardWidth - 44,
  );
  const pointerTop = placeAbove ? cardTop + fittedCardHeight - 1 : cardTop - 27;

  return (
    <View
      ref={overlayRef}
      collapsable={false}
      pointerEvents="box-none"
      style={styles.overlay}
      onLayout={() => setOverlayReady(true)}
    >
      <View pointerEvents="none" style={[styles.dim, { top: 0, left: 0, right: 0, height: spotlight.y }]} />
      <View pointerEvents="none" style={[styles.dim, { top: spotlight.y, left: 0, width: spotlight.x, height: spotlight.height }]} />
      <View pointerEvents="none" style={[styles.dim, { top: spotlight.y, left: spotlight.x + spotlight.width, right: 0, height: spotlight.height }]} />
      <View pointerEvents="none" style={[styles.dim, { top: spotlight.y + spotlight.height, left: 0, right: 0, bottom: 0 }]} />
      <View pointerEvents="none" style={[styles.spotlight, spotlight]} />

      <View
        onLayout={(event) => {
          if (Math.abs(event.nativeEvent.layout.height - cardHeight) > 1) setCardHeight(event.nativeEvent.layout.height);
        }}
        style={[styles.card, { left: cardLeft, top: cardTop, width: cardWidth, maxHeight: overlayFrame.height * 0.55 }]}
      >
        <View style={styles.header}>
          <RescueMascot size={44} animated />
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>KAYA’S INTERACTIVE TOUR</Text>
            <Text style={styles.kaya}>{step.title}</Text>
          </View>
          <Text style={styles.stepCount}>{currentStep + 1}/{steps.length}</Text>
        </View>

        <Text style={styles.message}>{step.message}</Text>
        <Text style={styles.hint}>Tap the highlighted feature to try it, or use Next to continue. Come back here to resume the tour.</Text>

        <View style={styles.footer}>
          <Pressable onPress={() => void finishTutorial()} disabled={isSaving} accessibilityRole="button" accessibilityLabel="Skip tutorial">
            <Text style={[styles.skip, isSaving && styles.disabled]}>Skip tour</Text>
          </Pressable>
          <View style={styles.navigation}>
            {currentStep > 0 && (
              <Pressable onPress={() => changeStep(currentStep - 1)} disabled={isSaving} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Previous tutorial step">
                <MaterialCommunityIcons name="chevron-left" size={20} color={Colors.text} />
                <Text style={styles.backText}>Back</Text>
              </Pressable>
            )}
            <Pressable onPress={goNext} disabled={isSaving} style={[styles.nextButton, isSaving && styles.disabledButton]} accessibilityRole="button" accessibilityLabel={currentStep === steps.length - 1 ? 'Finish tutorial' : 'Next tutorial step'}>
              <Text style={styles.nextText}>{currentStep === steps.length - 1 ? 'Done' : 'Next'}</Text>
              {currentStep < steps.length - 1 && <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.white} />}
            </Pressable>
          </View>
        </View>
      </View>
      <MaterialCommunityIcons
        name={placeAbove ? 'arrow-down' : 'arrow-up'}
        size={28}
        color={Colors.primary}
        style={[styles.pointer, { left: pointerLeft, top: pointerTop }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 1000, elevation: 1000 },
  dim: { position: 'absolute', backgroundColor: 'rgba(20, 26, 34, 0.68)' },
  spotlight: { position: 'absolute', borderWidth: 3, borderColor: Colors.primary, borderRadius: 18 },
  card: { position: 'absolute', padding: 15, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: '#F1C7D9', shadowColor: '#182230', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.24, shadowRadius: 18, elevation: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerCopy: { flex: 1 },
  eyebrow: { color: Colors.brandBlueDeep, fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  kaya: { marginTop: 3, color: Colors.primary, fontSize: 17, lineHeight: 22, fontWeight: '900' },
  stepCount: { color: Colors.textMuted, fontSize: 10, fontWeight: '800' },
  message: { marginTop: 11, color: Colors.text, fontSize: 13, lineHeight: 19 },
  hint: { marginTop: 8, color: Colors.brandBlueDeep, fontSize: 10, lineHeight: 15, fontWeight: '700' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  skip: { paddingVertical: 9, color: Colors.textMuted, fontSize: 11, fontWeight: '700' },
  navigation: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backButton: { minHeight: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, borderRadius: 11 },
  backText: { color: Colors.text, fontSize: 11, fontWeight: '700' },
  nextButton: { minHeight: 40, minWidth: 82, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 13, borderRadius: 12, backgroundColor: Colors.primary },
  nextText: { color: Colors.white, fontSize: 11, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  disabledButton: { opacity: 0.55 },
  pointer: { position: 'absolute', zIndex: 1001, elevation: 1001 },
});
