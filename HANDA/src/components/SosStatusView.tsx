import { ThemeAwareView } from '@components/ThemeAware';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable } from '@components/Buttons';
import { Colors } from '@constants/colors';
import { AppBoldFontFamily, AppHeadingFontFamily, AppMediumFontFamily, AppSemiboldFontFamily } from '@constants/typography';

export type SosIncidentStatus = 'reported' | 'acknowledged' | 'in_progress' | 'resolved';
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type Stage = {
  title: string;
  detail: string;
  hint: string;
  icon: IconName;
  accent: string;
  soft: string;
  gradient: [string, string];
};

const STAGES: Stage[] = [
  { title: 'Processing…', detail: 'Waiting for CDRRMO to respond.', hint: 'Your alert has been received. Stay calm and keep this screen open.', icon: 'timer-sand', accent: '#B45309', soft: '#FFE2AE', gradient: ['#FFF9EC', '#FFEBC4'] },
  { title: 'Help is on the way!', detail: 'CDRRMO is responding to your emergency.', hint: 'Responders have been dispatched. Stay where they can find you.', icon: 'ambulance', accent: '#1259B8', soft: '#C9E2FF', gradient: ['#F0F7FF', '#D4E8FF'] },
  { title: 'Resolved', detail: 'Your emergency request has been completed.', hint: 'You can send another alert any time you need help.', icon: 'check-bold', accent: '#177A37', soft: '#C4EBCD', gradient: ['#F1FAF3', '#D3EFDA'] },
];

const STEPS: { label: string; icon: IconName }[] = [
  { label: 'Sent', icon: 'send-check' },
  { label: 'Responding', icon: 'ambulance' },
  { label: 'Resolved', icon: 'shield-check' },
];

const TIPS: { icon: IconName; text: string }[] = [
  { icon: 'shield-account-outline', text: 'Stay calm and remain in a safe location.' },
  { icon: 'battery-charging-outline', text: 'Keep your phone charged and within reach.' },
  { icon: 'bullhorn-outline', text: 'Follow instructions from the response team.' },
];

export function getSosStage(status: SosIncidentStatus): 0 | 1 | 2 {
  if (status === 'resolved') return 2;
  return status === 'acknowledged' || status === 'in_progress' ? 1 : 0;
}

type Props = {
  status: SosIncidentStatus;
  emergencyType: string;
  locationLabel: string;
  sentAt: Date | null;
  etaMinutes: number | null;
  onReturnToSos: () => void;
  onOpenContacts: () => void;
};

export function SosStatusView({ status, emergencyType, locationLabel, sentAt, etaMinutes, onReturnToSos, onOpenContacts }: Props) {
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const stageIndex = getSosStage(status);
  const stage = STAGES[stageIndex];
  const isResolved = stageIndex === 2;
  const percent = [33, 66, 100][stageIndex];

  const progress = useRef(new Animated.Value(percent)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, { toValue: percent, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [percent, progress]);

  useEffect(() => {
    if (isResolved) {
      ring.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [isResolved, ring]);

  const progressWidth = progress.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  const ringStyle = { opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }] };
  const sentLabel = sentAt ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(sentAt) : '—';
  const details: { icon: IconName; label: string; value: string }[] = [
    { icon: 'alert-decagram-outline', label: 'Emergency', value: emergencyType },
    { icon: 'map-marker-radius-outline', label: 'Location', value: locationLabel },
    { icon: 'clock-time-four-outline', label: 'Alert sent', value: sentLabel },
  ];

  const hero = (
    <LinearGradient colors={stage.gradient} style={styles.hero} accessibilityLiveRegion="polite">
      <ThemeAwareView style={styles.heroTopRow}>
        <ThemeAwareView style={[styles.chip, { backgroundColor: stage.soft }]}>
          <MaterialCommunityIcons name="lifebuoy" size={13} color={stage.accent} />
          <Text darkText style={[styles.chipText, { color: stage.accent }]} numberOfLines={1}>{emergencyType.toUpperCase()}</Text>
        </ThemeAwareView>
        <ThemeAwareView style={styles.liveChip}>
          <ThemeAwareView style={[styles.liveDot, { backgroundColor: isResolved ? '#177A37' : '#D62828' }]} />
          <Text darkText style={styles.liveText}>{isResolved ? 'CLOSED' : 'LIVE'}</Text>
        </ThemeAwareView>
      </ThemeAwareView>

      <ThemeAwareView style={styles.iconStage}>
        {!isResolved && <Animated.View style={[styles.iconRing, { backgroundColor: stage.soft }, ringStyle]} />}
        <ThemeAwareView style={[styles.iconBubble, { backgroundColor: stage.soft }]}>
          <MaterialCommunityIcons name={stage.icon} size={44} color={stage.accent} />
        </ThemeAwareView>
      </ThemeAwareView>

      <Text darkText style={[styles.heroTitle, { color: stage.accent }]}>{stage.title}</Text>
      <Text darkText style={styles.heroDetail}>{stage.detail}</Text>
      <Text darkText style={styles.heroHint}>{stage.hint}</Text>
      {stageIndex === 1 && etaMinutes != null && (
        <ThemeAwareView style={[styles.etaPill, { backgroundColor: stage.soft }]}>
          <MaterialCommunityIcons name="clock-fast" size={15} color={stage.accent} />
          <Text darkText style={[styles.etaText, { color: stage.accent }]}>Estimated arrival · {etaMinutes} min</Text>
        </ThemeAwareView>
      )}
      {isResolved && (
        <AnimatedPressable
          style={[styles.primaryButton, styles.resolvedButton]}
          onPress={onReturnToSos}
          accessibilityRole="button"
          accessibilityLabel="Finish and return to the SOS button"
        >
          <MaterialCommunityIcons name="alarm-light-outline" size={20} color={Colors.white} />
          <Text darkText style={styles.primaryButtonText}>Done · Return to SOS</Text>
        </AnimatedPressable>
      )}
    </LinearGradient>
  );

  const tracker = (
    <ThemeAwareView style={styles.card}>
      <ThemeAwareView style={styles.stepper}>
        {STEPS.map((step, index) => {
          const done = index === 0 || stageIndex > index || (index === 2 && isResolved);
          const current = !done && index === stageIndex;
          const color = done ? '#177A37' : current ? stage.accent : Colors.border;
          return (
            <React.Fragment key={step.label}>
              <ThemeAwareView style={styles.step}>
                <ThemeAwareView style={[styles.stepDot, done && styles.stepDotDone, current && { borderColor: stage.accent, backgroundColor: stage.soft }]}>
                  <MaterialCommunityIcons name={done ? 'check' : step.icon} size={done ? 18 : 16} color={done ? Colors.white : current ? stage.accent : Colors.textMuted} />
                </ThemeAwareView>
                <Text style={[styles.stepLabel, (done || current) && { color: color, fontFamily: AppBoldFontFamily }]} numberOfLines={1}>{step.label}</Text>
              </ThemeAwareView>
              {index < STEPS.length - 1 && <ThemeAwareView style={[styles.connector, stageIndex > index && styles.connectorDone]} />}
            </React.Fragment>
          );
        })}
      </ThemeAwareView>
      <ThemeAwareView style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth, backgroundColor: isResolved ? '#177A37' : stage.accent }]} />
      </ThemeAwareView>
      <ThemeAwareView style={styles.progressMeta}>
        <Text style={styles.progressLabel}>Response progress</Text>
        <Text style={[styles.progressValue, { color: isResolved ? '#177A37' : stage.accent }]}>{percent}%</Text>
      </ThemeAwareView>
    </ThemeAwareView>
  );

  const info = (
    <ThemeAwareView style={styles.card}>
      <Text style={styles.cardTitle}>ALERT DETAILS</Text>
      {details.map((item, index) => (
        <ThemeAwareView key={item.label} style={[styles.detailRow, index > 0 && styles.detailRowBorder]}>
          <ThemeAwareView style={styles.detailIcon}><MaterialCommunityIcons name={item.icon} size={18} color={Colors.secondary} /></ThemeAwareView>
          <ThemeAwareView style={styles.detailCopy}>
            <Text style={styles.detailLabel}>{item.label}</Text>
            <Text style={styles.detailValue}>{item.value}</Text>
          </ThemeAwareView>
        </ThemeAwareView>
      ))}
    </ThemeAwareView>
  );

  const tips = (
    <ThemeAwareView style={styles.tipsCard}>
      <ThemeAwareView style={styles.tipsHeader}>
        <MaterialCommunityIcons name="shield-check-outline" size={18} color="#177A37" />
        <Text darkText style={styles.tipsTitle}>SAFETY TIPS</Text>
      </ThemeAwareView>
      {TIPS.map((tip) => (
        <ThemeAwareView key={tip.text} style={styles.tipRow}>
          <MaterialCommunityIcons name={tip.icon} size={17} color="#2F7D45" />
          <Text darkText style={styles.tipText}>{tip.text}</Text>
        </ThemeAwareView>
      ))}
    </ThemeAwareView>
  );

  const contactAction = !isResolved ? (
    <AnimatedPressable style={styles.secondaryButton} onPress={onOpenContacts} accessibilityRole="button" accessibilityLabel="Open emergency contacts">
      <MaterialCommunityIcons name="phone-in-talk-outline" size={19} color={Colors.primary} />
      <Text style={styles.secondaryButtonText}>Emergency contacts</Text>
    </AnimatedPressable>
  ) : null;

  return (
    <ThemeAwareView style={[styles.wrap, { maxWidth: isWide ? 960 : 560 }]}>
      <ThemeAwareView style={[styles.columns, isWide && styles.columnsWide]}>
        <ThemeAwareView style={styles.column}>{hero}{tracker}</ThemeAwareView>
        <ThemeAwareView style={styles.column}>{info}{tips}{contactAction}</ThemeAwareView>
      </ThemeAwareView>
    </ThemeAwareView>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignSelf: 'center' },
  columns: { gap: 14 },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { flex: 1, gap: 14, minWidth: 0 },

  hero: { borderRadius: 24, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 22, alignItems: 'center', overflow: 'hidden', shadowColor: '#0B3A63', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 4 },
  heroTopRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chip: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  chipText: { fontFamily: AppBoldFontFamily, fontSize: 10, letterSpacing: 0.8, flexShrink: 1 },
  liveChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.75)' },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontFamily: AppBoldFontFamily, color: '#1F2A37', fontSize: 10, letterSpacing: 0.8 },
  iconStage: { width: 128, height: 128, marginTop: 18, alignItems: 'center', justifyContent: 'center' },
  iconRing: { position: 'absolute', width: 96, height: 96, borderRadius: 48 },
  iconBubble: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.85)' },
  heroTitle: { fontFamily: AppHeadingFontFamily, fontSize: 26, lineHeight: 32, textAlign: 'center', marginTop: 8 },
  heroDetail: { fontFamily: AppSemiboldFontFamily, color: '#2B3A4A', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  heroHint: { fontFamily: AppMediumFontFamily, color: '#5A6B7B', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6, maxWidth: 320 },
  etaPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  etaText: { fontFamily: AppBoldFontFamily, fontSize: 12 },

  card: { backgroundColor: Colors.surface, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: Colors.border, shadowColor: '#0B3A63', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  cardTitle: { fontFamily: AppBoldFontFamily, color: Colors.textMuted, fontSize: 11, letterSpacing: 1.2, marginBottom: 4 },

  stepper: { flexDirection: 'row', alignItems: 'flex-start' },
  step: { width: 76, alignItems: 'center', gap: 6 },
  stepDot: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.border, backgroundColor: Colors.surface },
  stepDotDone: { borderColor: '#177A37', backgroundColor: '#177A37' },
  stepLabel: { fontFamily: AppMediumFontFamily, color: Colors.textMuted, fontSize: 11 },
  connector: { flex: 1, height: 3, borderRadius: 2, marginTop: 17, backgroundColor: Colors.border },
  connectorDone: { backgroundColor: '#177A37' },
  progressTrack: { height: 8, marginTop: 18, borderRadius: 4, overflow: 'hidden', backgroundColor: '#E3EAF0' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  progressLabel: { fontFamily: AppMediumFontFamily, color: Colors.textMuted, fontSize: 11 },
  progressValue: { fontFamily: AppBoldFontFamily, fontSize: 12 },

  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  detailRowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  detailIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F1FA' },
  detailCopy: { flex: 1, minWidth: 0 },
  detailLabel: { fontFamily: AppMediumFontFamily, color: Colors.textMuted, fontSize: 11 },
  detailValue: { fontFamily: AppSemiboldFontFamily, color: Colors.text, fontSize: 13, marginTop: 2 },

  tipsCard: { borderRadius: 20, padding: 18, backgroundColor: '#EFF8E6', gap: 10 },
  tipsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipsTitle: { fontFamily: AppBoldFontFamily, color: '#1F5F32', fontSize: 11, letterSpacing: 1.2 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tipText: { flex: 1, fontFamily: AppMediumFontFamily, color: '#32523B', fontSize: 12, lineHeight: 18 },

  primaryButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, backgroundColor: '#1E9446', shadowColor: '#1E9446', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 4 },
  resolvedButton: { alignSelf: 'stretch', marginTop: 14, paddingHorizontal: 12 },
  primaryButtonText: { fontFamily: AppBoldFontFamily, color: Colors.white, fontSize: 15 },
  secondaryButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.surface },
  secondaryButtonText: { fontFamily: AppBoldFontFamily, color: Colors.primary, fontSize: 14 },
});
