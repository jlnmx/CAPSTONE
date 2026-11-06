/**
 * HANDA Logo Component
 */

import React from 'react';
import { View, Image, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { ThemedText as Text } from '@components/ThemedText';
import { Colors, Typography, Spacing } from '@constants/colors';

const logoSource = require('../../assets/images/handa-logo.png');

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showTagline?: boolean;
}

export function HandaLogo({ size = 'medium', showTagline = false }: LogoProps) {
  const sizeStyles = {
    small: { fontSize: 24, iconSize: 32 },
    medium: { fontSize: 32, iconSize: 48 },
    large: { fontSize: 40, iconSize: 64 },
  };

  const style = sizeStyles[size];

  return (
    <View style={styles.container}>
      <Image
        source={logoSource}
        style={{ width: style.iconSize, height: style.iconSize, marginBottom: Spacing.md }}
        resizeMode="contain"
        accessibilityLabel="HANDA logo"
      />
      <Text style={[styles.logoText, { fontSize: style.fontSize }]}>HANDA</Text>
      {showTagline && <Text style={styles.tagline}>Ready When Connectivity Isn't.</Text>}
    </View>
  );
}

interface LogoBadgeProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** HANDA mark on a white circle so the green logo stays visible on green headers. */
export function HandaLogoBadge({ size = 44, style }: LogoBadgeProps) {
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <Image
        source={logoSource}
        style={{ width: size * 0.78, height: size * 0.78 }}
        resizeMode="contain"
        accessibilityLabel="HANDA logo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  logoText: {
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
});
