import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: number;
}

export default function Avatar({ uri, name, size = 40 }: AvatarProps) {
  const dimensions = { width: size, height: size, borderRadius: size / 2 };
  if (uri) return <Image source={{ uri }} style={[styles.image, dimensions]} accessibilityLabel={name ? `${name} profile picture` : 'Profile picture'} />;
  const initials = (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
  return <View style={[styles.fallback, dimensions]}><Text style={[styles.initials, { fontSize: Math.max(10, size * 0.38) }]}>{initials}</Text></View>;
}

const styles = StyleSheet.create({
  image: { backgroundColor: '#E3EAEE' },
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCEBDD' },
  initials: { color: '#1B6B2A', fontWeight: '800' },
});
