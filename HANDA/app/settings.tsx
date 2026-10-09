import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, BorderRadius, Spacing } from '@constants/colors';
import { useAuth } from '@hooks/useAuth';
import { useResponsiveLayout } from '@hooks/useResponsiveLayout';
import { ThemeMode, useTheme } from '@hooks/useTheme';

const themeOptions: Array<{ value: ThemeMode; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; detail: string }> = [
  { value: 'light', label: 'Light', icon: 'white-balance-sunny', detail: 'Keep the interface bright' },
  { value: 'system', label: 'System', icon: 'cellphone-cog', detail: 'Follow your device preference' },
  { value: 'dark', label: 'Dark', icon: 'weather-night', detail: 'Use a darker interface' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { gutter } = useResponsiveLayout();
  const { mode, palette, setMode } = useTheme();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/(auth)/login');
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) return <View style={[styles.loading, { backgroundColor: palette.background }]}><ActivityIndicator color={Colors.secondary} /></View>;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Go back"><MaterialCommunityIcons name="arrow-left" size={23} color={Colors.white} /></Pressable>
          <View><Text style={styles.eyebrow}>PREFERENCES</Text><Text style={styles.title}>Settings</Text></View>
        </View>
        <View style={styles.intro}><Text style={[styles.introTitle, { color: palette.text }]}>Make HANDA yours</Text><Text style={[styles.introText, { color: palette.textMuted }]}>Choose how HANDA should look. Your choice is saved on this device.</Text></View>
        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.sectionHeading}><View style={styles.sectionIcon}><MaterialCommunityIcons name="theme-light-dark" size={20} color={Colors.secondary} /></View><View><Text style={[styles.sectionTitle, { color: palette.text }]}>Appearance</Text><Text style={[styles.sectionDetail, { color: palette.textMuted }]}>Changes apply immediately</Text></View></View>
          <View style={styles.themeList}>{themeOptions.map((option) => { const selected = option.value === mode; return <Pressable key={option.value} onPress={() => void setMode(option.value)} accessibilityRole="radio" accessibilityState={{ selected }} style={[styles.themeOption, { borderColor: palette.border }, selected && styles.themeOptionSelected]}><MaterialCommunityIcons name={option.icon} size={22} color={selected ? Colors.secondary : palette.textMuted} /><View style={styles.themeCopy}><Text style={[styles.themeLabel, { color: palette.text }]}>{option.label}</Text><Text style={[styles.themeDetail, { color: palette.textMuted }]}>{option.detail}</Text></View>{selected && <MaterialCommunityIcons name="check-circle" size={20} color={Colors.secondary} />}</Pressable>; })}</View>
        </View>
        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.sectionHeading}><View style={styles.sectionIcon}><MaterialCommunityIcons name="bell-outline" size={20} color={Colors.secondary} /></View><View><Text style={[styles.sectionTitle, { color: palette.text }]}>Notifications</Text><Text style={[styles.sectionDetail, { color: palette.textMuted }]}>More controls can be connected here</Text></View></View>
          <Pressable disabled style={styles.actionRow}><Text style={[styles.actionLabel, { color: palette.text }]}>Alert preferences</Text><MaterialCommunityIcons name="chevron-right" size={22} color={palette.textMuted} /></Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface }, content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: Spacing['3xl'] },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, backgroundColor: '#218B25', flexDirection: 'row', alignItems: 'center', gap: Spacing.md }, backButton: { width: 42, height: 42, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' }, eyebrow: { color: '#D8F0D8', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 }, title: { marginTop: 2, color: Colors.white, fontSize: 28, fontWeight: '800' },
  intro: { paddingTop: Spacing.xl, paddingBottom: Spacing.lg }, introTitle: { color: Colors.text, fontSize: 21, fontWeight: '800' }, introText: { maxWidth: 520, marginTop: Spacing.xs, color: Colors.textMuted, fontSize: 13, lineHeight: 20 }, section: { marginBottom: Spacing.lg, padding: Spacing.lg, borderWidth: 1, borderColor: '#8BC58B', borderRadius: BorderRadius.md, backgroundColor: Colors.surface }, sectionHeading: { flexDirection: 'row', alignItems: 'center' }, sectionIcon: { width: 38, height: 38, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceMuted }, sectionTitle: { marginLeft: Spacing.md, color: Colors.text, fontSize: 16, fontWeight: '800' }, sectionDetail: { marginLeft: Spacing.md, marginTop: 2, color: Colors.textMuted, fontSize: 11 },
  themeList: { marginTop: Spacing.lg, gap: Spacing.sm }, themeOption: { minHeight: 64, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, flexDirection: 'row', alignItems: 'center', opacity: 0.72 }, themeOptionSelected: { borderColor: Colors.secondary, backgroundColor: Colors.surfaceMuted, opacity: 1 }, themeCopy: { flex: 1, marginLeft: Spacing.md }, themeLabel: { color: Colors.text, fontSize: 14, fontWeight: '700' }, themeDetail: { marginTop: 3, color: Colors.textMuted, fontSize: 11 }, actionRow: { minHeight: 52, marginTop: Spacing.lg, paddingHorizontal: Spacing.md, borderTopWidth: 1, borderTopColor: '#E8EDF1', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: 0.65 }, actionLabel: { color: Colors.text, fontSize: 14, fontWeight: '600' },
});