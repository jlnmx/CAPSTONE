import React from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import type { LiveTyphoon } from '@types/weather';

function formatUpdateTime(value: string | null): string {
  if (!value) return 'Update time unavailable';
  const timestamp = /Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`;
  return `Updated ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(new Date(timestamp))} UTC`;
}

export function TyphoonCard({ typhoon }: { typhoon: LiveTyphoon }) {
  const isInsidePar = typhoon.par_status === 'Inside PAR';
  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <MaterialCommunityIcons name="weather-hurricane" size={26} color="#9A3434" />
        <View style={styles.titleCopy}>
          <Text style={styles.label}>INTERNATIONAL NAME</Text>
          <Text style={styles.name}>Typhoon {typhoon.international_name}</Text>
          <Text style={styles.status}>ACTIVE · {typhoon.par_status.toUpperCase()}</Text>
          <Text style={styles.updated}>{formatUpdateTime(typhoon.updated_at)}</Text>
        </View>
      </View>
      <View style={styles.dataGrid}>
        <View style={styles.dataItem}>
          <Text style={styles.label}>MAX WIND</Text>
          <Text style={styles.value}>{typhoon.max_wind_kmh === null ? 'Not reported' : `${typhoon.max_wind_kmh} km/h`}</Text>
        </View>
        <View style={styles.dataItem}>
          <Text style={styles.label}>GUST SPEED</Text>
          <Text style={styles.value}>{typhoon.gust_speed_kmh === null ? 'Not reported by GDACS' : `${typhoon.gust_speed_kmh} km/h`}</Text>
        </View>
        <View style={styles.dataItem}>
          <Text style={styles.label}>PAGASA SIGNAL</Text>
          <Text style={styles.value}>{typhoon.signal_no === null ? (isInsidePar ? 'Check current bulletin' : 'Not issued outside PAR') : `No. ${typhoon.signal_no}`}</Text>
        </View>
        <View style={styles.dataItem}>
          <Text style={styles.label}>TRACK SOURCE</Text>
          <Text style={styles.value}>{typhoon.data_source}</Text>
        </View>
      </View>
      <View style={styles.links}>
        <Pressable onPress={() => void Linking.openURL(typhoon.source_url)} accessibilityRole="link">
          <Text style={styles.link}>Track details</Text>
        </Pressable>
        <Pressable onPress={() => void Linking.openURL('https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin')} accessibilityRole="link">
          <Text style={styles.link}>PAGASA bulletin</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 18, marginBottom: 8, padding: 12, borderRadius: 8, backgroundColor: '#FFF1E8', borderLeftWidth: 4, borderLeftColor: '#B94837' },
  heading: { flexDirection: 'row', alignItems: 'center' },
  titleCopy: { flex: 1, marginLeft: 9 },
  label: { color: '#775B56', fontSize: 8, fontWeight: '800' },
  name: { color: '#702C27', fontSize: 14, fontWeight: '800' },
  status: { color: '#8A4139', fontSize: 9, fontWeight: '800', marginTop: 2 },
  updated: { color: '#775B56', fontSize: 9, marginTop: 2 },
  dataGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D9BEB4' },
  dataItem: { width: '50%', paddingTop: 8, paddingRight: 6 },
  label: { color: '#775B56', fontSize: 8, fontWeight: '800' },
  value: { color: '#452C29', fontSize: 10, fontWeight: '700', marginTop: 2 },
  links: { flexDirection: 'row', gap: 16, marginTop: 10 },
  link: { color: '#175384', fontSize: 10, fontWeight: '700', textDecorationLine: 'underline' },
});