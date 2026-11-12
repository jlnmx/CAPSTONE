import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { Href } from 'expo-router';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable } from '@components/Buttons';
import AppBackArrow from '@components/AppBackArrow';
import { Colors } from '@constants/colors';
import { KIT_GREEN, Reveal, kitFonts } from '@components/IncidentCardKit';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export { KIT_GREEN, Reveal, kitFonts };

export function GradientHeader({ title, subtitle, icon, right, showBack = false, fallbackHref }: { title: string; subtitle?: string; icon?: IconName; right?: React.ReactNode; showBack?: boolean; fallbackHref?: Href }) {
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter]);
  return (
    <LinearGradient colors={['#1F9A2E', '#176B1D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={kit.header}>
      {icon && <MaterialCommunityIcons name={icon} size={140} color="rgba(255,255,255,0.08)" style={kit.headerGlyph} />}
      {showBack && <AppBackArrow fallbackHref={fallbackHref} />}
      <Animated.View style={[kit.headerCopy, { opacity: enter, transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }] }]}>
        <Text style={kit.headerTitle}>{title}</Text>
        {!!subtitle && <Text style={kit.headerSubtitle}>{subtitle}</Text>}
      </Animated.View>
      {right ?? (icon ? <View style={kit.headerBadge}><MaterialCommunityIcons name={icon} size={22} color="#FFFFFF" /></View> : null)}
    </LinearGradient>
  );
}

export function SectionCard({ index = 0, title, icon, aside, children }: { index?: number; title: string; icon: IconName; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Reveal index={index}>
      <View style={kit.card}>
        <View style={kit.cardHeading}>
          <View style={kit.cardIcon}><MaterialCommunityIcons name={icon} size={17} color={KIT_GREEN} /></View>
          <Text style={kit.cardTitle}>{title}</Text>
          {aside}
        </View>
        {children}
      </View>
    </Reveal>
  );
}

export function Field({ label, required, hint, style, ...input }: { label: string; required?: boolean; hint?: string } & TextInputProps) {
  const [focused, setFocused] = useState(false);
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(glow, { toValue: focused ? 1 : 0, duration: 180, useNativeDriver: false }).start();
  }, [focused, glow]);
  return (
    <View style={kit.field}>
      <Text style={kit.label}>{label}{required && <Text style={kit.required}> *</Text>}</Text>
      <Animated.View style={[kit.inputWrap, { borderColor: glow.interpolate({ inputRange: [0, 1], outputRange: ['#D9E3D9', KIT_GREEN] }), backgroundColor: glow.interpolate({ inputRange: [0, 1], outputRange: ['#FFFFFF', '#F4FAF4'] }) }]}>
        <TextInput {...input} style={[kit.input, style]} placeholderTextColor="#9DB59E" selectionColor={KIT_GREEN} onFocus={(event) => { setFocused(true); input.onFocus?.(event); }} onBlur={(event) => { setFocused(false); input.onBlur?.(event); }} />
      </Animated.View>
      {!!hint && <Text style={kit.hint}>{hint}</Text>}
    </View>
  );
}

function SexButton({ option, selected, onPress }: { option: 'Female' | 'Male'; selected: boolean; onPress: () => void }) {
  const pop = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: selected ? 1 : 0, useNativeDriver: false, speed: 22, bounciness: 8 }).start();
  }, [pop, selected]);
  return (
    <AnimatedPressable style={kit.sexTouch} onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={option}>
      <Animated.View style={[kit.sexButton, { backgroundColor: pop.interpolate({ inputRange: [0, 1], outputRange: ['#FFFFFF', KIT_GREEN] }), borderColor: pop.interpolate({ inputRange: [0, 1], outputRange: ['#D9E3D9', KIT_GREEN] }), transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }] }]}>
        <MaterialCommunityIcons name={option === 'Female' ? 'gender-female' : 'gender-male'} size={19} color={selected ? '#FFFFFF' : KIT_GREEN} />
        <Text style={[kit.sexText, selected && kit.sexTextActive]}>{option}</Text>
        {selected && <MaterialCommunityIcons name="check-circle" size={16} color="#FFFFFF" />}
      </Animated.View>
    </AnimatedPressable>
  );
}

export function SexToggle({ value, onChange, fromAccount }: { value: string; onChange: (value: string) => void; fromAccount?: boolean }) {
  return (
    <View style={kit.field}>
      <Text style={kit.label}>Sex<Text style={kit.required}> *</Text></Text>
      <View style={kit.sexRow} accessibilityRole="radiogroup">
        {(['Female', 'Male'] as const).map((option) => <SexButton key={option} option={option} selected={value === option} onPress={() => onChange(option)} />)}
      </View>
      {fromAccount && !!value && <Text style={kit.hint}>Pre-selected from your account. Tap to change.</Text>}
    </View>
  );
}

export function PrimaryButton({ label, icon, onPress, disabled, loading }: { label: string; icon?: IconName; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <AnimatedPressable style={[kit.primary, disabled && kit.primaryDisabled]} onPress={onPress} disabled={disabled} accessibilityRole="button">
      <Text style={kit.primaryText}>{loading ? 'Please wait...' : label}</Text>
      {icon && !loading && <MaterialCommunityIcons name={icon} size={18} color="#FFFFFF" />}
    </AnimatedPressable>
  );
}

export const kitStyles = {
  fontBold: kitFonts.bold,
  fontSemibold: kitFonts.semibold,
  fontMedium: kitFonts.medium,
  fontHeading: kitFonts.heading,
};

const kit = StyleSheet.create({
  header: { minHeight: 96, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 20, borderBottomLeftRadius: 26, borderBottomRightRadius: 26, flexDirection: 'row', alignItems: 'center', gap: 8, overflow: 'hidden' },
  headerGlyph: { position: 'absolute', right: -16, bottom: -30 },
  headerCopy: { flex: 1 },
  headerTitle: { color: '#FFFFFF', fontFamily: kitFonts.heading, fontSize: 22, lineHeight: 27 },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontFamily: kitFonts.medium, fontSize: 11, marginTop: 2 },
  headerBadge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  card: { marginHorizontal: 14, marginTop: 14, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: '#E0EAE0', backgroundColor: '#FFFFFF', shadowColor: '#103A18', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 2 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 4 },
  cardIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E4F1E4' },
  cardTitle: { flex: 1, color: Colors.text, fontFamily: kitFonts.heading, fontSize: 14 },
  field: { marginTop: 12 },
  label: { color: '#476B49', fontFamily: kitFonts.semibold, fontSize: 11, marginBottom: 6 },
  required: { color: '#D33D3D' },
  inputWrap: { borderWidth: 1.5, borderRadius: 14, overflow: 'hidden' },
  input: { minHeight: 46, paddingHorizontal: 14, color: Colors.text, fontFamily: kitFonts.medium, fontSize: 14 },
  hint: { color: Colors.textMuted, fontFamily: kitFonts.medium, fontSize: 10, marginTop: 5 },
  sexRow: { flexDirection: 'row', gap: 10 },
  sexTouch: { flex: 1 },
  sexButton: { minHeight: 48, borderRadius: 14, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  sexText: { color: Colors.text, fontFamily: kitFonts.bold, fontSize: 14 },
  sexTextActive: { color: '#FFFFFF' },
  primary: { minHeight: 52, marginTop: 18, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: KIT_GREEN, shadowColor: KIT_GREEN, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { color: '#FFFFFF', fontFamily: kitFonts.bold, fontSize: 14 },
});
