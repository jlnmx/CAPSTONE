/**
 * HANDA Color Palette
 * Professional emergency-response application design
 */

export const Colors = {
  // Primary Colors
  primary: '#0B3A63', // Dark Navy Blue
  secondary: '#1769AA', // Secondary Blue
  
  // Emergency Colors
  emergency: '#D62828', // Emergency Red
  success: '#2E8B57', // Green for online/success
  warning: '#F4A261', // Amber/Orange for warnings
  
  // Backgrounds
  background: '#F5F7FA', // Light gray background
  white: '#FFFFFF', // White
  
  // Text Colors
  text: '#17212B', // Dark text
  textMuted: '#667085', // Muted text
  
  // Functional
  offline: '#E63946', // Red for offline status
  online: '#2E8B57', // Green for online status
  pending: '#F4A261', // Amber for pending sync
  synced: '#2E8B57', // Green for synced
  
  // Transparent overlays
  overlay: 'rgba(0, 0, 0, 0.5)',
  shadowColor: 'rgba(0, 0, 0, 0.1)',
};

export const Typography = {
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  weights: {
    thin: '100' as const,
    extralight: '200' as const,
    light: '300' as const,
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
    black: '900' as const,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 2,
  },
  md: {
    shadowColor: 'rgba(0, 0, 0, 0.15)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  lg: {
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
};
