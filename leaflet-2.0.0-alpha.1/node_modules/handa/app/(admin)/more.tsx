import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, BorderRadius, Shadows, Spacing } from '@constants/colors';

const items = [
  { title: 'Incident management', detail: 'Review reports and update response status', icon: 'alert-circle-outline' as const, route: '/(admin)/operations' },
  { title: 'Disaster events', detail: 'Create, edit, and archive active events', icon: 'weather-hurricane' as const, route: '/(admin)/disasters' },
  { title: 'Analytics and reports', detail: 'Statistics, charts, and exportable reports', icon: 'chart-box-outline' as const, route: '/(admin)/analytics' },
  { title: 'System logs and settings', detail: 'Sync logs, audit trail, and system preferences', icon: 'cog-outline' as const, route: '/(admin)/system' },
];

export default function AdminMore() { return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}><Text style={styles.eyebrow}>ADMINISTRATION</Text><Text style={styles.title}>More controls</Text><Text style={styles.subtitle}>Additional tools for operating and auditing HANDA.</Text><View style={styles.list}>{items.map((item) => <TouchableOpacity key={item.title} style={styles.item} onPress={() => router.push(item.route)}><View style={styles.icon}><MaterialCommunityIcons name={item.icon} size={23} color={Colors.secondary} /></View><View style={styles.copy}><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.detail}>{item.detail}</Text></View><MaterialCommunityIcons name="chevron-right" size={21} color={Colors.textMuted} /></TouchableOpacity>)}</View></ScrollView></SafeAreaView>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#F4F7F9' }, content: { padding: Spacing.xl, maxWidth: 900, width: '100%', alignSelf: 'center' }, eyebrow: { color: Colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }, title: { color: Colors.text, fontSize: 30, fontWeight: '800', marginTop: 5 }, subtitle: { color: Colors.textMuted, fontSize: 14, marginTop: 6 }, list: { marginTop: 24, gap: 12 }, item: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.white, padding: 18, borderRadius: BorderRadius.md, ...Shadows.sm }, icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E7F0F5', alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1 }, itemTitle: { color: Colors.text, fontSize: 14, fontWeight: '800' }, detail: { color: Colors.textMuted, fontSize: 12, marginTop: 4 } });