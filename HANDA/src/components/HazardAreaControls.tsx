import { ThemeAwareView, ThemeAwarePressable } from '@components/ThemeAware';
import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';
import { useTheme } from '@hooks/useTheme';

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
  const { palette } = useTheme();
  const [expanded, setExpanded] = useState(false);

  return (
    <ThemeAwareView
      style={[styles.panel, expanded && styles.expandedPanel, { backgroundColor: palette.surface, borderColor: palette.border }]}
      accessibilityLabel="Hazard area map layers"
    >
      <Pressable
        style={styles.toggle}
        onPress={() => setExpanded((isExpanded) => !isExpanded)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} hazard area layers`}
      >
        <MaterialCommunityIcons name="layers-outline" size={16} color={Colors.primary} />
        <Text style={styles.heading}>HAZARDS</Text>
        <ThemeAwareView style={styles.summaryDots}>
          <ThemeAwareView style={[styles.summaryDot, { backgroundColor: visibility.flood ? '#C62828' : palette.border }]} />
          <ThemeAwareView style={[styles.summaryDot, { backgroundColor: visibility.earthquake ? '#EF6C00' : palette.border }]} />
        </ThemeAwareView>
        <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={palette.textMuted} />
      </Pressable>
      {expanded && (
        <ThemeAwareView style={styles.layers}>
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
            Barangay highlights only—not precise flood zones or fault lines. PSA/NAMRIA via OCHA COD-AB (CC BY-IGO 3.0).
          </Text>
        </ThemeAwareView>
      )}
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
        color={selected ? color : '#8A96A0'}
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
    minWidth: 132,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 5,
    shadowColor: '#142418',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  expandedPanel: { width: 188, padding: 7 },
  toggle: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9 },
  heading: { color: Colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  summaryDots: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 4 },
  summaryDot: { width: 7, height: 7, borderRadius: 4 },
  layers: { gap: 1 },
  layer: { minHeight: 31, flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 14, borderWidth: 1, borderRadius: 4 },
  label: { flex: 1, color: Colors.text, fontSize: 9, fontWeight: '700' },
  note: { marginTop: 3, color: Colors.textMuted, fontSize: 7, lineHeight: 9 },
});
