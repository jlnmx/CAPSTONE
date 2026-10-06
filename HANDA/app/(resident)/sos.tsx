import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, SafeAreaView, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { AnimatedPressable as Pressable } from '@components/Buttons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';

const emergencyTypes = [
  { label: 'Flood / landslide', icon: 'waves' as const },
  { label: 'Fire', icon: 'fire' as const },
  { label: 'Medical', icon: 'medical-bag' as const },
  { label: 'Rescue / trapped', icon: 'lifebuoy' as const },
  { label: 'Other / unsure', icon: 'help-circle-outline' as const },
];

export default function ResidentSosScreen() {
  const { width } = useWindowDimensions();
  const sosDiameter = Math.min(218, Math.max(176, width - 72));
  const sosButtonDiameter = sosDiameter - 34;
  const [selectedType, setSelectedType] = useState('Other / unsure');
  const [isHolding, setIsHolding] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.035, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => {
      animation.stop();
      if (holdTimer.current) clearTimeout(holdTimer.current);
    };
  }, [pulse]);

  const activateSos = () => {
    setIsActivated(true);
    setIsHolding(false);
    progress.setValue(1);
    Alert.alert('SOS activated', `Emergency responders have been notified. Situation: ${selectedType}.`);
  };

  const startHolding = () => {
    if (isActivated) return;
    setIsHolding(true);
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 2000, useNativeDriver: false }).start();
    holdTimer.current = setTimeout(activateSos, 2000);
  };

  const stopHolding = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (!isActivated) {
      setIsHolding(false);
      Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: false }).start();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>HANDA EMERGENCY ASSISTANCE</Text>
        <Text style={styles.title}>Need immediate help?</Text>
        <Text style={styles.description}>Hold the SOS button for 2 seconds to alert the response team.</Text>

        <View style={styles.readiness}><View style={styles.readinessDot} /><Text style={styles.readinessText}>RESPONSE NETWORK READY</Text><Text style={styles.readinessDetail}>Location sharing available</Text></View>

        <Text style={styles.sectionTitle}>WHAT KIND OF SITUATION?</Text>
        <Text style={styles.sectionHint}>Optional, but it helps responders prepare.</Text>
        <View style={styles.typeGrid}>{emergencyTypes.map((type) => <Pressable key={type.label} style={[styles.typeChip, selectedType === type.label && styles.typeChipSelected]} onPress={() => setSelectedType(type.label)}><MaterialCommunityIcons name={type.icon} size={17} color={selectedType === type.label ? Colors.white : Colors.primary} /><Text style={[styles.typeLabel, selectedType === type.label && styles.typeLabelSelected]}>{type.label}</Text></Pressable>)}</View>

        <Animated.View style={[styles.sosShell, { transform: [{ scale: pulse }] }]}>
          <View style={[styles.sosRing, { width: sosDiameter, height: sosDiameter, borderRadius: sosDiameter / 2 }]}>
            <Pressable style={({ pressed }) => [styles.sosButton, { width: sosButtonDiameter, height: sosButtonDiameter, borderRadius: sosButtonDiameter / 2 }, isHolding && styles.sosButtonHolding, isActivated && styles.sosButtonActivated, pressed && styles.sosButtonPressed]} onPressIn={startHolding} onPressOut={stopHolding} accessibilityLabel="Press and hold to activate emergency SOS">
              <MaterialCommunityIcons name={isActivated ? 'check-circle-outline' : 'alarm-light-outline'} size={43} color={isHolding || isActivated ? '#FFF36B' : Colors.white} />
              <Text style={styles.sosLabel}>{isActivated ? 'SENT' : 'SOS'}</Text>
              <Text style={styles.sosState}>{isActivated ? 'HELP IS ON THE WAY' : isHolding ? 'KEEP HOLDING...' : 'PRESS & HOLD 2 SEC'}</Text>
            </Pressable>
            <Animated.View style={[styles.progressArc, { width: sosDiameter, height: sosDiameter, borderRadius: sosDiameter / 2, opacity: progress }]} />
          </View>
        </Animated.View>

        <View style={styles.expectCard}><MaterialCommunityIcons name="shield-check-outline" size={22} color={Colors.primary} /><View style={styles.expectCopy}><Text style={styles.expectTitle}>WHAT TO EXPECT</Text><Text style={styles.expectText}>{isActivated ? 'Your request is being monitored by emergency responders.' : 'Your location and situation type will be shared with the response team after activation.'}</Text></View></View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FA' },
  content: { flexGrow: 1, alignItems: 'center', paddingTop: 30, paddingHorizontal: 20, paddingBottom: 28 },
  eyebrow: { color: Colors.emergency, fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  title: { color: Colors.primary, fontSize: 25, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  description: { maxWidth: 330, color: Colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 7 },
  readiness: { width: '100%', maxWidth: 430, minHeight: 42, marginTop: 20, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#E8F3EC', flexDirection: 'row', alignItems: 'center' },
  readinessDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success, marginRight: 8 },
  readinessText: { color: '#166534', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  readinessDetail: { flex: 1, color: '#54705C', fontSize: 10, textAlign: 'right' },
  sectionTitle: { color: Colors.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1, marginTop: 21 },
  sectionHint: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
  typeGrid: { maxWidth: 440, marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7 },
  typeChip: { minHeight: 36, paddingHorizontal: 12, borderWidth: 1, borderColor: '#D8E0E7', borderRadius: 20, backgroundColor: Colors.white, flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeChipSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  typeLabel: { color: Colors.primary, fontSize: 10, fontWeight: '700' },
  typeLabelSelected: { color: Colors.white },
  sosShell: { marginTop: 20 },
  sosRing: { borderWidth: 10, borderColor: '#D99B94', backgroundColor: '#F2D2CE', alignItems: 'center', justifyContent: 'center', shadowColor: '#8F3F35', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 8 },
  sosButton: { backgroundColor: '#B44F45', borderWidth: 4, borderColor: '#D48176', alignItems: 'center', justifyContent: 'center' },
  sosButtonHolding: { backgroundColor: '#983C35' },
  sosButtonActivated: { backgroundColor: '#2E8B57', borderColor: '#9ED5AE' },
  sosButtonPressed: { transform: [{ scale: 0.97 }] },
  progressArc: { position: 'absolute', borderWidth: 5, borderColor: '#FFF36B' },
  sosLabel: { color: Colors.white, fontSize: 31, fontWeight: '900', marginTop: 2 },
  sosState: { color: '#FFF36B', fontSize: 9, fontWeight: '900', marginTop: 4, letterSpacing: 0.4 },
  expectCard: { width: '100%', maxWidth: 430, marginTop: 20, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 8, backgroundColor: Colors.white, flexDirection: 'row', alignItems: 'flex-start', shadowColor: Colors.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 5, elevation: 2 },
  expectCopy: { flex: 1, marginLeft: 10 },
  expectTitle: { color: Colors.primary, fontSize: 11, fontWeight: '900', letterSpacing: 0.7 },
  expectText: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 4 },
});