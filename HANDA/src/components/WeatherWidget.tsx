import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, getReadableColor } from '@constants/colors';
import { useTheme } from '@hooks/useTheme';
import { getTimeOfDayPresentation } from '@utils/weatherTime';
import { WeatherPresentation, getSafetyTip } from '@utils/weatherPresentation';
import type { WeatherSnapshot } from '@hooks/useWeather';

export function WeatherWidget({ weather, presentation, isLoading, isUnavailable, time, disasterActive = false }: { weather: WeatherSnapshot; presentation: WeatherPresentation; isLoading: boolean; isUnavailable: boolean; time: Date; disasterActive?: boolean }) {
  const timePresentation = getTimeOfDayPresentation(time);
  return <>
    <View style={styles.weatherCard}>
      <LinearGradient colors={presentation.gradient} style={styles.weatherGradient}>
        <MaterialCommunityIcons name={presentation.backgroundIcon} size={138} color="rgba(255,255,255,0.10)" style={styles.backgroundGlyph} />
        <View style={styles.weatherCardTop}><View><Text style={styles.weatherEyebrow}>LIVE CONDITIONS · {timePresentation.label.toUpperCase()}</Text><Text style={styles.weatherLocation}>Biñan City forecast</Text></View><MaterialCommunityIcons name={presentation.icon} size={30} color={Colors.white} /></View>
        {isLoading ? <ActivityIndicator color={Colors.white} /> : <><View style={styles.weatherMain}><Text style={styles.temperature}>{Math.round(weather.temperature)}° C</Text><Text style={styles.weatherDescription}>{presentation.description}</Text></View><Text style={styles.weatherMeta}>Feels like {Math.round(weather.feelsLike)}°  |  Humidity {weather.humidity}%  |  Wind {Math.round(weather.windSpeed)} km/h</Text></>}
        {isUnavailable && <Text style={styles.weatherMeta}>Showing the latest local estimate for Biñan City.</Text>}
      </LinearGradient>
    </View>
    <SafetyTip presentation={presentation} time={time} disasterActive={disasterActive} />
  </>;
}

function SafetyTip({ presentation, time, disasterActive }: { presentation: WeatherPresentation; time: Date; disasterActive: boolean }) {
  const { resolvedTheme } = useTheme();
  const [dismissed, setDismissed] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  const timePresentation = getTimeOfDayPresentation(time);
  const tip = getSafetyTip(presentation, timePresentation.label, disasterActive);
  const accent = getReadableColor(presentation.accent, resolvedTheme);
  const alertColor = getReadableColor(Colors.emergency, resolvedTheme);

  useEffect(() => {
    Animated.parallel([Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }), Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8 })]).start();
  }, [opacity, translateY, tip.title]);

  const dismiss = () => Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setDismissed(true));
  const restore = () => {
    setDismissed(false);
    opacity.setValue(0);
    translateY.setValue(8);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8 }),
    ]).start();
  };
  if (dismissed) return <Pressable style={styles.restoreTip} onPress={restore}><MaterialCommunityIcons name="information-outline" size={16} color={accent} /><Text style={[styles.restoreText, { color: presentation.accent }]}>Show safety tip</Text></Pressable>;
  return <Animated.View style={[styles.tipCard, { borderLeftColor: disasterActive ? alertColor : accent, opacity, transform: [{ translateY }] }]}><MaterialCommunityIcons name={disasterActive ? 'alert-outline' : 'information-outline'} size={20} color={disasterActive ? alertColor : accent} /><View style={styles.tipCopy}><Text darkText style={styles.tipTitle}>{tip.title}</Text><Text darkText style={styles.tipText}>{tip.detail}</Text></View><Pressable onPress={dismiss} accessibilityLabel="Dismiss safety tip" style={styles.dismissButton}><MaterialCommunityIcons name="close" size={16} color="#344054" /></Pressable></Animated.View>;
}

const styles = StyleSheet.create({
  weatherCard: { minHeight: 112, marginHorizontal: 18, marginTop: 2, marginBottom: 9, borderRadius: 8, overflow: 'hidden' }, weatherGradient: { flex: 1, minHeight: 112, paddingHorizontal: 14, paddingVertical: 12, overflow: 'hidden' }, backgroundGlyph: { position: 'absolute', right: -12, bottom: -22 }, weatherCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }, weatherEyebrow: { color: 'rgba(255,255,255,0.78)', fontSize: 8, fontWeight: '800', letterSpacing: 1.2 }, weatherLocation: { color: Colors.white, fontSize: 11, fontWeight: '700', marginTop: 2 }, weatherMain: { flexDirection: 'row', alignItems: 'baseline', gap: 9 }, temperature: { color: Colors.white, fontSize: 20, fontWeight: '800' }, weatherDescription: { color: '#D8E8F4', fontSize: 9, marginTop: 2 }, weatherMeta: { color: '#F3FAFF', fontSize: 9, marginTop: 9 }, tipCard: { minHeight: 62, marginHorizontal: 18, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 10, borderLeftWidth: 4, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.78)', flexDirection: 'row', alignItems: 'center' }, tipCopy: { flex: 1, marginLeft: 9 }, tipTitle: { color: '#344054', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }, tipText: { color: '#344054', fontSize: 10, lineHeight: 15, marginTop: 3 }, dismissButton: { width: 26, height: 30, alignItems: 'center', justifyContent: 'center' }, restoreTip: { minHeight: 34, marginHorizontal: 18, marginBottom: 12, paddingHorizontal: 10, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.78)', flexDirection: 'row', alignItems: 'center', gap: 7 }, restoreText: { fontSize: 10, fontWeight: '800' },
});