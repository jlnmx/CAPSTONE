/**
 * HANDA Logo Component
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '@constants/colors';

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
      <View style={[styles.logoIcon, { width: style.iconSize, height: style.iconSize }]}>
        <Text style={[styles.iconText, { fontSize: style.iconSize * 0.6 }]}>🛡️</Text>
      </View>
      <Text style={[styles.logoText, { fontSize: style.fontSize }]}>HANDA</Text>
      {showTagline && <Text style={styles.tagline}>Ready When Connectivity Isn't.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  iconText: {
    textAlign: 'center',
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
