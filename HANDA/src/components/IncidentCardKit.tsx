import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';
import { AppBoldFontFamily, AppHeadingFontFamily, AppMediumFontFamily, AppSemiboldFontFamily } from '@constants/typography';
import { incidentStatusColor, incidentStatusLabel } from '@constants/incidentStatus';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export const KIT_GREEN = '#218B25';
export const kitFonts = { heading: AppHeadingFontFamily, bold: AppBoldFontFamily, semibold: AppSemiboldFontFamily, medium: AppMediumFontFamily };

export function incidentTypeIcon(type: string): IconName {
  const value = type.toLowerCase();
  if (value.includes('fire')) return 'fire';
  if (value.includes('flood')) return 'waves';
  if (value.includes('medical') || value.includes('injur')) return 'medical-bag';
  if (value.includes('accident') || value.includes('crash') || value.includes('vehic')) return 'car-emergency';
  if (value.includes('earthquake') || value.includes('landslide')) return 'image-filter-hdr';
  if (value.includes('crime') || value.includes('theft') || value.includes('robbery') || value.includes('violence')) return 'shield-alert-outline';
  if (value.includes('typhoon') || value.includes('storm') || value.includes('wind')) return 'weather-hurricane';
  return 'alert-outline';
}

export function Reveal({ index, children }: { index: number; children: React.ReactNode }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 420, delay: Math.min(index, 8) * 70, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [index, progress]);
  return <Animated.View style={{ opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }, { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] }}>{children}</Animated.View>;
}

export function PulseDot({ color, size = 8 }: { color: string; size?: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const box = size * 2.4;
  return <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
    <Animated.View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }] }} />
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
  </View>;
}

export function StatusPill({ status }: { status: string }) {
  const color = incidentStatusColor(status);
  return <View style={[kit.pill, { backgroundColor: `${color}1A`, borderColor: `${color}55` }]}>
    <PulseDot color={color} size={6} />
    <Text style={[kit.pillText, { color }]}>{incidentStatusLabel(status).toUpperCase()}</Text>
  </View>;
}

const STEPS = ['reported', 'acknowledged', 'in_progress'] as const;

export function ProgressSteps({ status }: { status: string }) {
  const current = Math.max(0, STEPS.indexOf(status as typeof STEPS[number]));
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fill, { toValue: current / (STEPS.length - 1), duration: 700, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [current, fill]);
  return <View style={kit.steps} accessibilityLabel={`Progress: ${incidentStatusLabel(status)}`}>
    <View style={kit.stepsTrack}><Animated.View style={[kit.stepsFill, { backgroundColor: incidentStatusColor(status), width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} /></View>
    <View style={kit.stepsRow}>{STEPS.map((step, index) => {
      const reached = index <= current;
      const color = incidentStatusColor(step);
      return <View key={step} style={kit.step}>
        <View style={[kit.stepDot, reached ? { backgroundColor: color, borderColor: color } : null]}>{reached && <MaterialCommunityIcons name="check" size={9} color="#FFFFFF" />}</View>
        <Text style={[kit.stepLabel, reached && { color: Colors.text, fontFamily: AppBoldFontFamily }]}>{incidentStatusLabel(step)}</Text>
      </View>;
    })}</View>
  </View>;
}

export function IncidentTypeBadge({ type, status }: { type: string; status: string }) {
  const color = incidentStatusColor(status);
  return <View style={[kit.typeBadge, { backgroundColor: `${color}18`, borderColor: `${color}40` }]}><MaterialCommunityIcons name={incidentTypeIcon(type)} size={24} color={color} /></View>;
}

const kit = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: 9, paddingLeft: 4, height: 22, borderRadius: 999, borderWidth: 1 },
  pillText: { fontFamily: AppBoldFontFamily, fontSize: 9, letterSpacing: 0.8 },
  steps: { marginTop: 12 },
  stepsTrack: { position: 'absolute', left: 39, right: 39, top: 6, height: 3, borderRadius: 2, backgroundColor: '#E3EAE3', overflow: 'hidden' },
  stepsFill: { height: '100%', borderRadius: 2 },
  stepsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  step: { alignItems: 'center', width: 78 },
  stepDot: { width: 15, height: 15, borderRadius: 8, borderWidth: 2, borderColor: '#CBD5CB', backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { color: Colors.textMuted, fontFamily: AppMediumFontFamily, fontSize: 9, marginTop: 4 },
  typeBadge: { width: 46, height: 46, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
