/**
 * Splash / Loading Screen
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  ImageBackground,
  View,
  StyleSheet,
  Text,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@constants/colors';

export default function SplashScreen() {
  const router = useRouter();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 2300,
      useNativeDriver: false,
    });
    animation.start();

    const timer = setTimeout(() => {
      router.replace('/(auth)/login');
    }, 2500); // 2.5 second delay

    return () => {
      animation.stop();
      clearTimeout(timer);
    };
  }, [progress, router]);

  return (
    <ImageBackground
      source={require('../pics/binancity.jpg')}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <View style={styles.branding}>
        <Text style={styles.logo}>HANDA</Text>
        <Text style={styles.tagline}>Laging handa para sayo.</Text>
      </View>
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['8%', '98%'],
              }),
            },
          ]}
        />
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignSelf: 'stretch',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 31, 54, 0.68)',
  },
  branding: {
    alignItems: 'center',
  },
  logo: {
    color: Colors.white,
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tagline: {
    color: Colors.white,
    fontSize: 14,
    marginTop: 2,
  },
  progressTrack: {
    position: 'absolute',
    bottom: 36,
    left: '14%',
    right: '14%',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  progressFill: {
    width: '98%',
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.white,
  },
});
