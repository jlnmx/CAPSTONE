import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors } from '@constants/colors';

export type OfflineMapPoint = {
  id: string;
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  color?: string;
};

type Props = {
  points: OfflineMapPoint[];
  onSelect?: (pointId: string) => void;
};

const REGION = { minLatitude: 14.25, maxLatitude: 14.36, minLongitude: 121.02, maxLongitude: 121.14 };

export default function OfflineMapCanvas({ points, onSelect }: Props) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setDimensions({ width, height });
  };

  return (
    <View style={styles.container} onLayout={onLayout} accessibilityLabel="Offline map with saved location markers">
      <View style={styles.notice}><Text style={styles.noticeText}>OFFLINE · Saved locations only · Google basemap and routes unavailable</Text></View>
      {dimensions.width > 0 && points.map((point) => {
        const x = Math.max(0.06, Math.min(0.94, (point.longitude - REGION.minLongitude) / (REGION.maxLongitude - REGION.minLongitude)));
        const y = Math.max(0.12, Math.min(0.88, 1 - (point.latitude - REGION.minLatitude) / (REGION.maxLatitude - REGION.minLatitude)));
        const left = Math.min(dimensions.width - 80, Math.max(0, x * dimensions.width - 12));
        const top = Math.min(dimensions.height - 42, Math.max(44, y * dimensions.height - 12));
        const selected = selectedId === point.id;
        return (
          <Pressable
            key={point.id}
            style={[styles.marker, { left, top }]}
            onPress={() => {
              setSelectedId(selected ? null : point.id);
              onSelect?.(point.id);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${point.title}${point.description ? `, ${point.description}` : ''}`}
          >
            <View style={[styles.dot, { backgroundColor: point.color ?? Colors.primary }]} />
            <Text numberOfLines={1} style={styles.markerLabel}>{point.title}</Text>
            {selected && point.description ? <Text numberOfLines={2} style={styles.markerDescription}>{point.description}</Text> : null}
          </Pressable>
        );
      })}
      {!points.length && <Text style={styles.empty}>No saved coordinates are available for this map.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#E8ECEA' },
  notice: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#F7F9F8' },
  noticeText: { color: '#526052', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  marker: { position: 'absolute', zIndex: 1, maxWidth: 130, minWidth: 42, minHeight: 26, paddingHorizontal: 5, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 6, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D5DDD8', elevation: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  markerLabel: { flexShrink: 1, color: '#17212B', fontSize: 9, fontWeight: '700' },
  markerDescription: { position: 'absolute', top: 27, left: 0, width: 150, padding: 5, borderRadius: 4, backgroundColor: '#FFFFFF', color: '#526052', fontSize: 9, elevation: 2 },
  empty: { alignSelf: 'center', marginTop: 60, color: '#526052', fontSize: 12, textAlign: 'center' },
});
