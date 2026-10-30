import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppBack } from '@hooks/useAppBack';

export default function AppBackArrow({ style }: { style?: ViewStyle }) {
  const goBack = useAppBack();
  return (
    <Pressable onPress={goBack} style={[styles.button, style]} accessibilityRole="button" accessibilityLabel="Go back to previous page">
      <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 40, height: 40, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.16)' },
});
