import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, getReadableColor } from '@constants/colors';
import { useTheme } from '@hooks/useTheme';
import { getTimeOfDayPresentation } from '@utils/weatherTime';
import { WeatherPresentation, getSafetyTip } from '@utils/weatherPresentation';
import type { WeatherEvent, WeatherEventType, WeatherSnapshot } from '@hooks/useWeather';

const weatherEventPresentation: Record<WeatherEventType, { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; color: string }> = {
  thunderstorms: { icon: 'weather-lightning-rainy', color: '#76502B' },
  'heavy-rain': { icon: 'weather-pouring', color: '#175384' },
  rain: { icon: 'weather-rainy', color: '#2873A8' },
  'rain-chance': { icon: 'weather-partly-rainy', color: '#527D9B' },
  'strong-winds': { icon: 'weather-windy', color: '#557A96' },
  'high-heat': { icon: 'weather-sunny-alert', color: '#D97725' },
};

export function WeatherWidget({ weather, weatherEvents, presentation, isLoading, isUnavailable, time, disasterActive = false }: { weather: WeatherSnapshot; weatherEvents: WeatherEvent[]; presentation: WeatherPresentation; isLoading: boolean; isUnavailable: boolean; time: Date; disasterActive?: boolean }) {
  const [selectedWeatherEventIndex, setSelectedWeatherEventIndex] = useState(0);
  const weatherEventIndex = weatherEvents.length > 0 ? selectedWeatherEventIndex % weatherEvents.length : 0;
  const weatherEventIds = weatherEvents.map((event) => event.id).join('|');
  const timePresentation = getTimeOfDayPresentation(time);

  useEffect(() => {
    setSelectedWeatherEventIndex(0);
  }, [weatherEventIds]);

  return <>
    <View style={styles.weatherCard}>
      <LinearGradient colors={presentation.gradient} style={styles.weatherGradient}>
        <MaterialCommunityIcons name={presentation.backgroundIcon} size={138} color="rgba(255,255,255,0.10)" style={styles.backgroundGlyph} />
        <View style={styles.weatherCardTop}><View><Text style={styles.weatherEyebrow}>LIVE CONDITIONS · {timePresentation.label.toUpperCase()}</Text><Text style={styles.weatherLocation}>Biñan City forecast</Text></View><MaterialCommunityIcons name={presentation.icon} size={30} color={Colors.white} /></View>
        {isLoading ? <ActivityIndicator color={Colors.white} /> : <><View style={styles.weatherMain}><Text style={styles.temperature}>{Math.round(weather.temperature)}° C</Text><Text style={styles.weatherDescription}>{presentation.description}</Text></View><Text style={styles.weatherMeta}>Feels like {Math.round(weather.feelsLike)}°  |  Humidity {weather.humidity}%  |  Wind {Math.round(weather.windSpeed)} km/h</Text></>}
        {isUnavailable && <Text style={styles.weatherMeta}>Showing the latest local estimate for Biñan City.</Text>}
        <SafetyTip presentation={presentation} time={time} disasterActive={disasterActive} />
      </LinearGradient>
    </View>
    <View style={styles.forecastSection}>
      <View style={[styles.forecastHeading, compactForecastStyles.forecastHeading]}>
        <Text style={styles.forecastTitle}>NEXT 24 HOURS IN BIÑAN</Text>
        <Text style={styles.forecastSource}>{weatherEvents.length > 0 ? `Event ${weatherEvents.length > 1 ? `${weatherEventIndex + 1} of ` : ''}${weatherEvents.length} · ` : ''}{isUnavailable ? 'Forecast unavailable' : 'Open-Meteo model outlook'}</Text>
      </View>
      {weatherEvents.length > 0 ? <WeatherEventSlideshow events={weatherEvents} index={weatherEventIndex} setIndex={setSelectedWeatherEventIndex} /> : <Text style={styles.noEvents}>{isLoading ? 'Checking the hourly forecast...' : isUnavailable ? 'Hourly forecast unavailable. Check official PAGASA advisories.' : 'No significant modeled rain, thunderstorm, wind, or heat events detected.'}</Text>}
      <Text style={styles.forecastDisclaimer}>Model outlook is not an official warning. Check PAGASA and local government advisories.</Text>
    </View>
  </>;
}

function WeatherEventSlideshow({ events, index, setIndex }: { events: WeatherEvent[]; index: number; setIndex: React.Dispatch<React.SetStateAction<number>> }) {
  const event = events[index];
  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (events.length < 2) return undefined;
    const timer = setInterval(() => setIndex((current) => (current + 1) % events.length), 7000);
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration: 7000, useNativeDriver: false });
    animation.start();
    return () => {
      clearInterval(timer);
      animation.stop();
    };
  }, [events.length, index, progress, setIndex]);

  useEffect(() => {
    fade.setValue(0);
    slide.setValue(10);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [event.id, fade, slide]);

  const showPrevious = () => setIndex((current) => (current - 1 + events.length) % events.length);
  const showNext = () => setIndex((current) => (current + 1) % events.length);
  const icon = weatherEventPresentation[event.type];

  return <View style={[styles.slideshow, compactForecastStyles.slideshow, { borderLeftColor: icon.color }]}>
    <Animated.View style={[styles.eventSlide, { opacity: fade, transform: [{ translateX: slide }] }]}>
      <View style={[styles.eventMain, compactForecastStyles.eventMain]}>
        <View style={[styles.eventIconTile, compactForecastStyles.eventIconTile, { backgroundColor: `${icon.color}18` }]}>
          <MaterialCommunityIcons name={icon.icon} size={24} color={icon.color} />
        </View>
        <View style={[styles.eventCopy, compactForecastStyles.eventCopy]}>
          <Text style={styles.eventEyebrow}>FORECAST EVENT</Text>
          <Text style={[styles.eventTitle, compactForecastStyles.eventTitle]}>{event.title}</Text>
        </View>
      </View>
      <View style={[styles.eventTimeChip, compactForecastStyles.eventTimeChip]}>
        <MaterialCommunityIcons name="clock-outline" size={14} color="#344054" />
        <Text style={styles.eventWindow}>{event.window}</Text>
      </View>
      <Text style={[styles.eventDetail, compactForecastStyles.eventDetail]}>{event.detail}</Text>
    </Animated.View>
    <View style={[styles.slideshowFooter, compactForecastStyles.slideshowFooter]}>
      <Pressable style={[styles.slideArrow, compactForecastStyles.slideArrow]} onPress={showPrevious} disabled={events.length < 2} accessibilityRole="button" accessibilityLabel="Previous forecast event">
        <MaterialCommunityIcons name="chevron-left" size={20} color={events.length < 2 ? '#AAB2B8' : '#344054'} />
      </Pressable>
      <View style={styles.slideDots}>
        {events.map((item, itemIndex) => <Pressable key={item.id} onPress={() => setIndex(itemIndex)} accessibilityRole="button" accessibilityLabel={`Show forecast event ${itemIndex + 1}: ${item.title}`} accessibilityState={{ selected: itemIndex === index }} style={[styles.slideDot, itemIndex === index && { backgroundColor: icon.color, width: 18 }]} />)}
      </View>
      <Text style={styles.slideCount}>{index + 1}/{events.length}</Text>
      <Pressable style={[styles.slideArrow, compactForecastStyles.slideArrow]} onPress={showNext} disabled={events.length < 2} accessibilityRole="button" accessibilityLabel="Next forecast event">
        <MaterialCommunityIcons name="chevron-right" size={20} color={events.length < 2 ? '#AAB2B8' : '#344054'} />
      </Pressable>
    </View>
    {events.length > 1 && <View style={[styles.progressTrack, compactForecastStyles.progressTrack]}><Animated.View style={[styles.progressFill, { backgroundColor: icon.color, width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} /></View>}
  </View>;
}

function SafetyTip({ presentation, time, disasterActive }: { presentation: WeatherPresentation; time: Date; disasterActive: boolean }) {
  const { resolvedTheme } = useTheme();
  const [dismissed, setDismissed] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  const timePresentation = getTimeOfDayPresentation(time);
  const tip = getSafetyTip(presentation, timePresentation.label, disasterActive);
  const accent = resolvedTheme === 'dark' ? '#1769AA' : presentation.accent;
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
  if (dismissed) return <Pressable style={styles.restoreTip} onPress={restore}><MaterialCommunityIcons name="information-outline" size={15} color={Colors.white} /><Text darkText style={styles.restoreText}>{'Show safety tip'}</Text></Pressable>;
  return <Animated.View style={[styles.tipCard, { opacity, transform: [{ translateY }] }]}><MaterialCommunityIcons name={disasterActive ? 'alert-outline' : 'information-outline'} size={18} color={disasterActive ? alertColor : Colors.white} /><View style={styles.tipCopy}><Text darkText style={styles.tipTitle}>{tip.title}</Text><Text darkText style={styles.tipText}>{tip.detail}</Text></View><Pressable onPress={dismiss} accessibilityLabel="Dismiss safety tip" style={styles.dismissButton}><MaterialCommunityIcons name="close" size={15} color={Colors.white} /></Pressable></Animated.View>;
}

const styles = StyleSheet.create({
  weatherCard: { minHeight: 112, marginHorizontal: 18, marginTop: 2, marginBottom: 9, borderRadius: 8, overflow: 'hidden' }, weatherGradient: { flex: 1, minHeight: 112, paddingHorizontal: 14, paddingVertical: 12, overflow: 'hidden' }, backgroundGlyph: { position: 'absolute', right: -12, bottom: -22 }, weatherCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }, weatherEyebrow: { color: 'rgba(255,255,255,0.78)', fontSize: 8, fontWeight: '800', letterSpacing: 1.2 }, weatherLocation: { color: Colors.white, fontSize: 11, fontWeight: '700', marginTop: 2 }, weatherMain: { flexDirection: 'row', alignItems: 'baseline', gap: 9 }, temperature: { color: Colors.white, fontSize: 20, fontWeight: '800' }, weatherDescription: { color: '#D8E8F4', fontSize: 9, marginTop: 2 }, weatherMeta: { color: '#F3FAFF', fontSize: 9, marginTop: 9 },
  forecastSection: { marginHorizontal: 18, marginBottom: 12 }, forecastHeading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 4, marginBottom: 8 }, forecastTitle: { color: '#344054', fontSize: 10, fontWeight: '800' }, forecastSource: { color: '#667085', fontSize: 9 }, slideshow: { minHeight: 164, borderWidth: 1, borderLeftWidth: 4, borderColor: '#D8E2E6', borderRadius: 8, backgroundColor: '#FFFFFF', paddingHorizontal: 13, paddingTop: 12, paddingBottom: 8, shadowColor: '#173B4D', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 7, elevation: 2 }, eventSlide: { flex: 1 }, eventMain: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 }, eventIconTile: { width: 46, height: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, eventCopy: { flex: 1, marginLeft: 11 }, eventEyebrow: { color: '#667085', fontSize: 8, fontWeight: '800' }, eventTitle: { color: '#243744', fontSize: 16, fontWeight: '800', marginTop: 2 }, eventTimeChip: { alignSelf: 'flex-start', maxWidth: '100%', minHeight: 29, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6, backgroundColor: '#F0F4F5' }, eventWindow: { color: '#344054', fontSize: 10, fontWeight: '700', flexShrink: 1 }, eventDetail: { color: '#475467', fontSize: 10, lineHeight: 15, marginTop: 8 }, slideshowFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }, slideArrow: { width: 32, height: 30, borderRadius: 6, backgroundColor: '#F0F4F5', alignItems: 'center', justifyContent: 'center' }, slideDots: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 }, slideDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#BCC6CC' }, slideCount: { color: '#667085', minWidth: 28, fontSize: 9, fontWeight: '700', textAlign: 'center' }, progressTrack: { height: 3, marginTop: 5, overflow: 'hidden', borderRadius: 2, backgroundColor: '#E8EEF0' }, progressFill: { height: '100%', borderRadius: 2 }, noEvents: { color: '#475467', fontSize: 10, lineHeight: 14, paddingVertical: 11, paddingHorizontal: 12, borderWidth: 1, borderColor: '#D8E2E6', borderRadius: 8, backgroundColor: '#FFFFFF' }, officialLink: { color: '#175384', fontSize: 10, fontWeight: '700', marginTop: 8, textDecorationLine: 'underline' }, forecastDisclaimer: { color: '#667085', fontSize: 9, lineHeight: 13, marginTop: 5 },
  tipCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.32)' }, tipCopy: { flex: 1 }, tipTitle: { color: Colors.white, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' }, tipText: { color: '#F3FAFF', fontSize: 10, lineHeight: 15, marginTop: 2 }, dismissButton: { width: 26, height: 24, alignItems: 'center', justifyContent: 'center' }, restoreTip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginTop: 8, paddingVertical: 2 }, restoreText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
});

const compactForecastStyles = StyleSheet.create({
  forecastHeading: { marginBottom: 6 },
  slideshow: { minHeight: 136, paddingHorizontal: 10, paddingTop: 9, paddingBottom: 6 },
  eventMain: { marginBottom: 6 },
  eventIconTile: { width: 38, height: 38 },
  eventCopy: { marginLeft: 9 },
  eventTitle: { fontSize: 14 },
  eventTimeChip: { minHeight: 26, paddingHorizontal: 8, paddingVertical: 4 },
  eventDetail: { marginTop: 6, lineHeight: 14 },
  slideshowFooter: { marginTop: 5 },
  slideArrow: { width: 28, height: 26 },
  progressTrack: { marginTop: 4 },
});