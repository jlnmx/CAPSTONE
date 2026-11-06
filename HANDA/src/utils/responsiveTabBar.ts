import { Platform, StyleSheet } from 'react-native';
import type { ThemePalette } from '@hooks/useTheme';

export function getResponsiveTabBarOptions(width: number, bottomInset: number, palette: ThemePalette) {
  const isCompact = width < 360;
  const isDesktop = width >= 1024;
  const horizontalGutter = isCompact ? 8 : 12;
  const baseHeight = isCompact ? 62 : isDesktop ? 78 : 72;
  const safeBottom = Platform.OS === 'web' ? 0 : bottomInset;

  return {
    tabBarLabelPosition: 'below-icon' as const,
    tabBarItemStyle: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: isCompact ? 0 : 2,
    },
    tabBarLabelStyle: {
      flexShrink: 1,
      includeFontPadding: false,
      ...(Platform.OS === 'web' ? { position: 'absolute' as const, bottom: 5 } : { marginTop: 2 }),
      fontSize: isCompact ? 9 : isDesktop ? 12 : 10.5,
      fontWeight: '700' as const,
      lineHeight: isCompact ? 11 : 13,
      textAlign: 'center' as const,
    },
    tabBarStyle: {
      width: isDesktop ? Math.min(width - 48, 840) : width - horizontalGutter * 2,
      alignSelf: 'center' as const,
      backgroundColor: palette.surface,
      borderTopColor: palette.border,
      borderTopWidth: 0,
      height: baseHeight + safeBottom,
      marginHorizontal: 0,
      marginBottom: Platform.OS === 'web' ? 8 : 6,
      borderRadius: 22,
      paddingBottom: Math.max(4, safeBottom),
      paddingTop: 4,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 24,
    },
  };
}

export function getResponsiveTabIconSize(width: number): number {
  if (width < 360) return 19;
  if (width >= 1024) return 24;
  return 22;
}
