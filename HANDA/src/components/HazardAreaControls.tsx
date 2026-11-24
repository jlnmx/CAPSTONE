import { ThemeAwareView, ThemeAwarePressable } from '@components/ThemeAware';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';

export type HazardAreaVisibility = {
  flood: boolean;
  earthquake: boolean;
};

type Props = {
  visibility: HazardAreaVisibility;
  onToggleFlood: () => void;
  onToggleEarthquake: () => void;
};

export function useHazardAreaVisibility() {
  const [flood, setFlood] = useState(true);
  const [earthquake, setEarthquake] = useState(true);
  return {
    visibility: { flood, earthquake },
    toggleFlood: () => setFlood((visible) => !visible),
    toggleEarthquake: () => setEarthquake((visible) => !visible),
  };
}

export default function HazardAreaControls({ visibility, onToggleFlood, onToggleEarthquake }: Props) {
  return (
    <ThemeAwareView style={styles.panel} accessibilityLabel="Hazard area map layers">
      <Text style={styles.heading}>HAZARD AREAS</Text>
      <HazardLayer
        label="Flood-prone barangays"
        color="#C62828"
        selected={visibility.flood}
        onPress={onToggleFlood}
      />
      <HazardLayer
        label="Earthquake / fault barangays"
        color="#EF6C00"
        selected={visibility.earthquake}
        onPress={onToggleEarthquake}
      />
      <Text style={styles.note}>
        Barangay-level highlights only; not precise flood zones or a fault trace. Boundaries: PSA/NAMRIA via OCHA COD-AB (CC BY-IGO 3.0).
      </Text>
    </ThemeAwareView>
  );
}

function HazardLayer({ label, color, selected, onPress }: { label: string; color: string; selected: boolean; onPress: () => void }) {
  return (
    <ThemeAwarePressable
      style={styles.layer}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label}, ${selected ? 'on' : 'off'}`}
    >
      <MaterialCommunityIcons
        name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'}
        size={18}
        color={selected ? color : Colors.textMuted}
      />
      <ThemeAwareView style={[styles.swatch, { backgroundColor: `${color}66`, borderColor: color }]} />
      <Text style={styles.label}>{label}</Text>
    </ThemeAwarePressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 72,
    right: 12,
    zIndex: 12,
    width: 220,
    padding: 9,
    gap: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.97)',
    elevation: 5,
    shadowColor: '#142418',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  heading: { marginBottom: 2, color: Colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  layer: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 7 },
  swatch: { width: 14, height: 14, borderWidth: 1, borderRadius: 4 },
  label: { flex: 1, color: Colors.text, fontSize: 10, fontWeight: '700' },
  note: { marginTop: 4, color: Colors.textMuted, fontSize: 8, lineHeight: 11 },
});
