import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AnimatedPressable } from '@components/Buttons';
import { Colors } from '@constants/colors';
import { AppHeadingFontFamily } from '@constants/typography';
import { useTheme } from '@hooks/useTheme';

interface ActiveDisasterCardProps {
  active: boolean;
  upcoming?: boolean;
  title: string;
  description: string;
  onPress?: () => void;
  interactiveWhenInactive?: boolean;
  accessibilityLabel?: string;
}

export function ActiveDisasterCard({ active, upcoming = false, title, description, onPress, interactiveWhenInactive = false, accessibilityLabel }: ActiveDisasterCardProps) {
  const { resolvedTheme } = useTheme();
  const sheen = useRef(new Animated.Value(-1)).current;
  const chevron = useRef(new Animated.Value(0)).current;
  const chevronAnimation = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!active) {
      sheen.stopAnimation();
      sheen.setValue(-1);
      chevronAnimation.current?.stop();
      chevron.stopAnimation();
      chevron.setValue(0);
      return undefined;
    }

    const sheenAnimation = Animated.loop(Animated.timing(sheen, { toValue: 1, duration: 2200, useNativeDriver: true }));
    sheenAnimation.start();
    return () => {
      sheenAnimation.stop();
      chevronAnimation.current?.stop();
    };
  }, [active, chevron, sheen]);

  const startChevron = () => {
    if (!active && !interactiveWhenInactive) return;
    chevronAnimation.current?.stop();
    chevronAnimation.current = Animated.loop(Animated.sequence([
      Animated.timing(chevron, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(chevron, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]));
    chevronAnimation.current.start();
  };

  const stopChevron = () => {
    chevronAnimation.current?.stop();
    chevron.setValue(0);
  };

  const sheenTranslate = sheen.interpolate({ inputRange: [-1, 1], outputRange: [-150, 520] });
  const chevronTranslate = chevron.interpolate({ inputRange: [0, 1], outputRange: [0, 7] });
  const darkAlertForeground = resolvedTheme === 'dark' && (active || upcoming);
  const cardForeground = darkAlertForeground ? '#000000' : upcoming && !active ? styles.upcomingText.color : Colors.white;

  return (
    <AnimatedPressable
      style={[styles.card, active && styles.cardActive, upcoming && !active && styles.cardUpcoming, !active && !upcoming && styles.cardEmpty]}
      onPress={active || interactiveWhenInactive ? onPress : undefined}
      disabled={!active && !interactiveWhenInactive}
      accessibilityRole={active || interactiveWhenInactive ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      onHoverIn={startChevron}
      onHoverOut={stopChevron}
      onPressIn={startChevron}
      onPressOut={stopChevron}
    >
      {active && <Animated.View pointerEvents="none" style={[styles.sheen, { transform: [{ translateX: sheenTranslate }, { rotate: '-16deg' }] }]} />}
      <MaterialCommunityIcons name={active ? 'alert-circle-outline' : 'weather-hurricane'} size={active ? 39 : 29} color={cardForeground} />
      <View style={styles.copy}>
        <Text darkText={darkAlertForeground} style={[styles.name, active && styles.nameActive, upcoming && !active && styles.upcomingText, darkAlertForeground && styles.darkAlertText]}>{title}</Text>
        <Text darkText={darkAlertForeground} style={[styles.description, active && styles.descriptionActive, upcoming && !active && styles.upcomingText, darkAlertForeground && styles.darkAlertText]}>{description}</Text>
      </View>
      <Animated.View style={{ transform: [{ translateX: chevronTranslate }] }}>
        {(active || interactiveWhenInactive) && <MaterialCommunityIcons name="chevron-right" size={31} color={cardForeground} />}
      </Animated.View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 61, marginHorizontal: 18, marginTop: 0, marginBottom: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#D63F43', flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  cardActive: { minHeight: 102, marginBottom: 12, paddingHorizontal: 14, borderRadius: 9 },
  cardUpcoming: { backgroundColor: '#F2C94C' },
  cardEmpty: { backgroundColor: '#6B7B85' },
  sheen: { position: 'absolute', top: -40, bottom: -40, width: 70, backgroundColor: 'rgba(255,255,255,0.25)' },
  copy: { flex: 1, marginLeft: 10 },
  name: { color: Colors.white, fontFamily: AppHeadingFontFamily, fontSize: 14, fontWeight: '800' },
  nameActive: { fontSize: 18, fontWeight: '700' },
  description: { color: Colors.white, fontSize: 9, marginTop: 2 },
  descriptionActive: { fontSize: 12 },
  upcomingText: { color: '#3D3100' },
  darkAlertText: { color: '#000000' },
});
