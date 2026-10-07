import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, BorderRadius, Spacing } from '@constants/colors';
import { useAuth } from '@hooks/useAuth';
import { useResponsiveLayout } from '@hooks/useResponsiveLayout';

type ThemeMode = 'light' | 'system' | 'dark';

const themeOptions: Array<{ value: ThemeMode; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; detail: string }> = [
  { value: 'light', label: 'Light', icon: 'white-balance-sunny', detail: 'Keep the interface bright' },
  { value: 'system', label: 'System', icon: 'cellphone-cog', detail: 'Follow your device preference' },
  { value: 'dark', label: 'Dark', icon: 'weather-night', detail: 'Use a darker interface' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { gutter } = useResponsiveLayout();
  const [themeMode] = useState<ThemeMode>('system');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/(auth)/login');
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) return <View style={styles.loading}><ActivityIndicator color={Colors.secondary} /></View>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Go back"><MaterialCommunityIcons name="arrow-left" size={23} color={Colors.white} /></Pressable>
          <View><Text style={styles.eyebrow}>PREFERENCES</Text><Text style={styles.title}>Settings</Text></View>
        </View>
        <View style={styles.intro}><Text style={styles.introTitle}>Make HANDA yours</Text><Text style={styles.introText}>Choose how the app should feel when you use it. These preferences are prepared for a future release.</Text></View>
        <View style={styles.section}>
          <View style={styles.sectionHeading}><View style={styles.sectionIcon}><MaterialCommunityIcons name="theme-light-dark" size={20} color={Colors.secondary} /></View><View><Text style={styles.sectionTitle}>Appearance</Text><Text style={styles.sectionDetail}>Theme selection is not active yet</Text></View></View>
          <View style={styles.themeList}>{themeOptions.map((option) => { const selected = option.value === themeMode; return <Pressable key={option.value} disabled style={[styles.themeOption, selected && styles.themeOptionSelected]}><MaterialCommunityIcons name={option.icon} size={22} color={selected ? Colors.secondary : Colors.textMuted} /><View style={styles.themeCopy}><Text style={styles.themeLabel}>{option.label}</Text><Text style={styles.themeDetail}>{option.detail}</Text></View>{selected && <MaterialCommunityIcons name="check-circle" size={20} color={Colors.secondary} />}</Pressable>; })}</View>
        </View>
        <View style={styles.section}>
          <View style={styles.sectionHeading}><View style={styles.sectionIcon}><MaterialCommunityIcons name="bell-outline" size={20} color={Colors.secondary} /></View><View><Text style={styles.sectionTitle}>Notifications</Text><Text style={styles.sectionDetail}>More controls can be connected here</Text></View></View>
          <Pressable disabled style={styles.actionRow}><Text style={styles.actionLabel}>Alert preferences</Text><MaterialCommunityIcons name="chevron-right" size={22} color={Colors.textMuted} /></Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.white }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white }, content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: Spacing['3xl'] },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, backgroundColor: '#218B25', flexDirection: 'row', alignItems: 'center', gap: Spacing.md }, backButton: { width: 42, height: 42, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' }, eyebrow: { color: '#D8F0D8', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 }, title: { marginTop: 2, color: Colors.white, fontSize: 28, fontWeight: '800' },
  intro: { paddingTop: Spacing.xl, paddingBottom: Spacing.lg }, introTitle: { color: '#155B19', fontSize: 21, fontWeight: '800' }, introText: { maxWidth: 520, marginTop: Spacing.xs, color: Colors.textMuted, fontSize: 13, lineHeight: 20 }, section: { marginBottom: Spacing.lg, padding: Spacing.lg, borderWidth: 1, borderColor: '#8BC58B', borderRadius: BorderRadius.md, backgroundColor: Colors.white }, sectionHeading: { flexDirection: 'row', alignItems: 'center' }, sectionIcon: { width: 38, height: 38, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF3EA' }, sectionTitle: { marginLeft: Spacing.md, color: '#155B19', fontSize: 16, fontWeight: '800' }, sectionDetail: { marginLeft: Spacing.md, marginTop: 2, color: Colors.textMuted, fontSize: 11 },
  themeList: { marginTop: Spacing.lg, gap: Spacing.sm }, themeOption: { minHeight: 64, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: '#E1E7EC', borderRadius: BorderRadius.md, flexDirection: 'row', alignItems: 'center', opacity: 0.72 }, themeOptionSelected: { borderColor: Colors.secondary, backgroundColor: '#F1F7FB', opacity: 1 }, themeCopy: { flex: 1, marginLeft: Spacing.md }, themeLabel: { color: Colors.text, fontSize: 14, fontWeight: '700' }, themeDetail: { marginTop: 3, color: Colors.textMuted, fontSize: 11 }, actionRow: { minHeight: 52, marginTop: Spacing.lg, paddingHorizontal: Spacing.md, borderTopWidth: 1, borderTopColor: '#E8EDF1', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: 0.65 }, actionLabel: { color: Colors.text, fontSize: 14, fontWeight: '600' },
});