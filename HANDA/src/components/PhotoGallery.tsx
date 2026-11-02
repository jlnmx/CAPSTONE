import React, { useEffect, useRef, useState } from 'react';
import { Image, ImageStyle, Modal, NativeScrollEvent, NativeSyntheticEvent, Platform, ScrollView, StatusBar, StyleProp, StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText as Text } from '@components/ThemedText';
import { AnimatedPressable } from '@components/Buttons';

interface PhotoViewerProps {
  uris: string[];
  startIndex: number | null;
  onClose: () => void;
}

export function PhotoViewer({ uris, startIndex, onClose }: PhotoViewerProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const visible = startIndex != null;

  useEffect(() => {
    if (startIndex == null) return;
    setIndex(startIndex);
    const timer = setTimeout(() => scrollRef.current?.scrollTo({ x: startIndex * width, animated: false }), 0);
    return () => clearTimeout(timer);
  }, [startIndex, width]);

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  const goTo = (next: number) => {
    if (next < 0 || next >= uris.length) return;
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        {visible && Platform.OS !== 'web' && <StatusBar backgroundColor="#000000" barStyle="light-content" />}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          contentOffset={{ x: (startIndex ?? 0) * width, y: 0 }}
        >
          {uris.map((uri, photoIndex) => (
            <ScrollView
              key={`${uri.slice(-24)}-${photoIndex}`}
              style={{ width, height }}
              contentContainerStyle={{ width, height, alignItems: 'center', justifyContent: 'center' }}
              maximumZoomScale={4}
              minimumZoomScale={1}
              bouncesZoom
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              centerContent
            >
              <Image source={{ uri }} style={{ width, height: height * 0.8 }} resizeMode="contain" accessibilityLabel={`Photo ${photoIndex + 1} of ${uris.length}`} />
            </ScrollView>
          ))}
        </ScrollView>

        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
          <View style={styles.counter}><Text style={styles.counterText}>{index + 1} / {uris.length}</Text></View>
          <AnimatedPressable style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close photo viewer">
            <MaterialCommunityIcons name="close" size={22} color="#FFFFFF" />
          </AnimatedPressable>
        </View>

        {uris.length > 1 && Platform.OS === 'web' && (
          <>
            {index > 0 && <AnimatedPressable style={[styles.arrow, { left: 12 }]} onPress={() => goTo(index - 1)} accessibilityLabel="Previous photo"><MaterialCommunityIcons name="chevron-left" size={28} color="#FFFFFF" /></AnimatedPressable>}
            {index < uris.length - 1 && <AnimatedPressable style={[styles.arrow, { right: 12 }]} onPress={() => goTo(index + 1)} accessibilityLabel="Next photo"><MaterialCommunityIcons name="chevron-right" size={28} color="#FFFFFF" /></AnimatedPressable>}
          </>
        )}

        {uris.length > 1 && (
          <View style={[styles.dots, { paddingBottom: insets.bottom + 18 }]} pointerEvents="none">
            {uris.map((_uri, dotIndex) => <View key={dotIndex} style={[styles.dot, dotIndex === index && styles.dotActive]} />)}
          </View>
        )}
      </View>
    </Modal>
  );
}

interface PhotoGalleryProps {
  uris: string[];
  style?: StyleProp<ViewStyle>;
  thumbnailStyle?: StyleProp<ImageStyle>;
}

/** Horizontally scrolling thumbnails; tapping one opens a fullscreen, swipeable viewer. */
export function PhotoGallery({ uris, style, thumbnailStyle }: PhotoGalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  if (!uris.length) return null;

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style}>
        {uris.map((uri, index) => (
          <AnimatedPressable key={`${uri.slice(-24)}-${index}`} onPress={() => setOpenIndex(index)} accessibilityRole="imagebutton" accessibilityLabel={`View photo ${index + 1} of ${uris.length}`}>
            <Image source={{ uri }} style={thumbnailStyle} />
          </AnimatedPressable>
        ))}
      </ScrollView>
      <PhotoViewer uris={uris} startIndex={openIndex} onClose={() => setOpenIndex(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  counter: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)' },
  counterText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  closeButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  arrow: { position: 'absolute', top: '50%', width: 44, height: 44, marginTop: -22, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' },
  dots: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#FFFFFF' },
});
