import { Platform } from 'react-native';
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
      position: 'absolute' as const,
      bottom: 5,
      fontSize: isCompact ? 8 : isDesktop ? 11 : 9,
      fontWeight: '700' as const,
      lineHeight: isCompact ? 10 : 12,
      textAlign: 'center' as const,
    },
    tabBarStyle: {
      width: isDesktop ? Math.min(width - 48, 840) : width - horizontalGutter * 2,
      alignSelf: 'center' as const,
      backgroundColor: palette.surface,
      borderTopColor: palette.border,
      borderTopWidth: 1,
      height: baseHeight + safeBottom,
      marginHorizontal: 0,
      marginBottom: Platform.OS === 'web' ? 8 : 0,
      borderRadius: 12,
      paddingBottom: Math.max(4, safeBottom),
      paddingTop: 4,
      shadowColor: '#163A25',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 5,
    },
  };
}

export function getResponsiveTabIconSize(width: number): number {
  if (width < 360) return 19;
  if (width >= 1024) return 24;
  return 22;
}
