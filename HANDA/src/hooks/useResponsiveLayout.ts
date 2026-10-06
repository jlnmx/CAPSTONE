import { useWindowDimensions } from 'react-native';

export function useResponsiveLayout() {
  const { width } = useWindowDimensions();
  const isCompact = width < 360;
  const isMobile = width < 600;
  const isTablet = width >= 600 && width < 1024;
  const scale = Math.max(0.9, Math.min(width / 390, 1.16));

  return {
    width,
    isCompact,
    isMobile,
    isTablet,
    scale,
    gutter: isCompact ? 12 : isMobile ? 16 : isTablet ? 24 : 32,
    buttonHeight: Math.max(44, Math.round(48 * scale)),
    contentMaxWidth: width >= 1024 ? 1440 : undefined,
  };
}