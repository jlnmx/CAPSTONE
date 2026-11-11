import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, ImageBackground, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText as Text } from '@components/ThemedText';
import { HandaLogoBadge } from '@components/HandaLogo';
import { AppBoldFontFamily, AppFontFamily, AppHeadingFontFamily, AppMediumFontFamily } from '@constants/typography';
import { useRouter } from 'expo-router';
import { warmUpServer } from '@services/apiClient';

export default function SplashScreen() {
  const router = useRouter();
  const [progressTrackWidth, setProgressTrackWidth] = useState(0);
  const entrance = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const loadingSweep = useRef(new Animated.Value(0)).current;
  const useNativeDriver = Platform.OS !== 'web';
  const sweepOffset = loadingSweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, progressTrackWidth],
  });

  useEffect(() => {
    warmUpServer();
    const entranceAnimation = Animated.timing(entrance, {
      toValue: 1,
      duration: 720,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    });
    const pulseAnimation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver }),
      Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver }),
    ]));
    const loadingAnimation = Animated.loop(Animated.timing(loadingSweep, {
      toValue: 1,
      duration: 1450,
      easing: Easing.linear,
      useNativeDriver,
    }));

    entranceAnimation.start();
    pulseAnimation.start();
    loadingAnimation.start();
    const timer = setTimeout(() => router.replace('/(auth)/login'), 2500);

    return () => {
      entranceAnimation.stop();
      pulseAnimation.stop();
      loadingAnimation.stop();
      clearTimeout(timer);
    };
  }, [entrance, loadingSweep, pulse, router, useNativeDriver]);

  return (
    <ImageBackground
      source={require('../pics/binancity.jpg')}
      style={styles.container}
      imageStyle={styles.backgroundImage}
      resizeMode="cover"
    >
      <StatusBar style="light" />
      <LinearGradient
        colors={['rgba(5, 23, 38, 0.30)', 'rgba(5, 27, 43, 0.72)', '#061B29']}
        locations={[0, 0.52, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        <View style={styles.locationPill}>
          <MaterialCommunityIcons name="map-marker-radius-outline" size={15} color="#A8E6CB" />
          <Text style={styles.locationText}>BIÑAN CITY  ·  LAGUNA</Text>
        </View>

        <Animated.View
          style={[
            styles.hero,
            {
              opacity: entrance,
              transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            },
          ]}
        >
          <View style={styles.markWrap}>
            <Animated.View
              style={[
                styles.markHalo,
                {
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.8] }),
                  transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
                },
              ]}
            />
            <HandaLogoBadge size={78} style={styles.logoBadge} />
          </View>

          <Text style={styles.wordmark}>HANDA</Text>
          <View style={styles.accentRule} />
          <Text style={styles.headline}>Ready for what matters.</Text>
          <Text style={styles.tagline}>Laging handa para sa ligtas na komunidad.</Text>
          <Text style={styles.description}>Preparedness, response, and evacuation support — together.</Text>
        </Animated.View>

        <View style={styles.loadingPanel}>
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#A8E6CB" />
            <Text style={styles.loadingText}>Getting HANDA ready</Text>
          </View>
          <View
            style={styles.progressTrack}
            onLayout={(event) => setProgressTrackWidth(event.nativeEvent.layout.width)}
          >
            <Animated.View style={[styles.progressSweep, { transform: [{ translateX: sweepOffset }] }]} />
          </View>
          <Text style={styles.footerText}>STAY INFORMED  ·  BE PREPARED  ·  STAY SAFE</Text>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    minHeight: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#061B29',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 26,
  },
  locationPill: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  locationText: {
    color: '#E8F4F2',
    fontFamily: AppBoldFontFamily,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  hero: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
  },
  markWrap: {
    width: 108,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
  },
  markHalo: {
    position: 'absolute',
    width: 102,
    height: 102,
    borderRadius: 51,
    borderWidth: 1,
    borderColor: 'rgba(168,230,203,0.75)',
    backgroundColor: 'rgba(168,230,203,0.08)',
  },
  logoBadge: {
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.82)',
    shadowColor: '#A8E6CB',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 8,
  },
  wordmark: {
    color: '#FFFFFF',
    fontFamily: AppHeadingFontFamily,
    fontSize: 46,
    letterSpacing: 4,
    lineHeight: 56,
  },
  accentRule: {
    width: 38,
    height: 3,
    borderRadius: 2,
    marginTop: 13,
    marginBottom: 17,
    backgroundColor: '#A8E6CB',
  },
  headline: {
    color: '#FFFFFF',
    fontFamily: AppMediumFontFamily,
    fontSize: 20,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  tagline: {
    color: '#C4DED7',
    fontFamily: AppFontFamily,
    fontSize: 14,
    marginTop: 9,
    textAlign: 'center',
  },
  description: {
    maxWidth: 290,
    color: 'rgba(240,248,246,0.75)',
    fontFamily: AppFontFamily,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
    textAlign: 'center',
  },
  loadingPanel: {
    width: '100%',
    maxWidth: 360,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(6,23,35,0.50)',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  loadingText: {
    color: '#E8F4F2',
    fontFamily: AppMediumFontFamily,
    fontSize: 12,
  },
  progressTrack: {
    height: 3,
    overflow: 'hidden',
    borderRadius: 2,
    marginTop: 14,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  progressSweep: {
    position: 'absolute',
    left: 0,
    width: 100,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#A8E6CB',
  },
  footerText: {
    color: 'rgba(232,244,242,0.58)',
    fontFamily: AppBoldFontFamily,
    fontSize: 8,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
});
