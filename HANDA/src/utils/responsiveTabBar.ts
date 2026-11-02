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
      borderTopWidth: StyleSheet.hairlineWidth,
      height: baseHeight + safeBottom,
      marginHorizontal: 0,
      marginBottom: Platform.OS === 'web' ? 8 : 0,
      borderRadius: 22,
      paddingBottom: Math.max(4, safeBottom),
      paddingTop: 4,
      shadowColor: '#163A25',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.16,
      shadowRadius: 14,
      elevation: 10,
    },
  };
}

export function getResponsiveTabIconSize(width: number): number {
  if (width < 360) return 19;
  if (width >= 1024) return 24;
  return 22;
}
