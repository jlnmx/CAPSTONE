import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useSegments, type Href } from 'expo-router';
import { StyleSheet, ViewStyle } from 'react-native';
import { AnimatedPressable } from '@components/Buttons';
import { useTheme } from '@hooks/useTheme';

type AppBackArrowProps = {
  style?: ViewStyle;
  onPress?: () => void;
  fallbackHref?: Href;
};

export default function AppBackArrow({ style, onPress, fallbackHref }: AppBackArrowProps) {
  const segments = useSegments();
  const { palette } = useTheme();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      const fallback = fallbackHref ?? (segments[0] === '(resident)'
        ? '/(resident)'
        : segments[0] === '(responder)'
          ? '/(responder)'
          : '/');
      router.replace(fallback);
    }
  };

  return (
    <AnimatedPressable
      style={[styles.button, { backgroundColor: palette.surface, borderColor: palette.border }, style]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      accessibilityHint="Returns to the previous screen"
    >
      <MaterialCommunityIcons name="arrow-left" size={21} color="#218B25" />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#123B18',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
});
