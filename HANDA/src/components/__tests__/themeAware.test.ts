import { adaptThemeSurfaceStyle } from '../../utils/themeColors';
import type { ThemePalette } from '../../hooks/useTheme';

const darkPalette: ThemePalette = {
  background: '#101820',
  surface: '#182631',
  surfaceMuted: '#223541',
  text: '#FFFFFF',
  textMuted: '#BFCAD0',
  border: '#344A58',
};

describe('dark theme surface adaptation', () => {
  it('replaces pale surfaces and borders with dark palette colors', () => {
    expect(adaptThemeSurfaceStyle({ backgroundColor: '#FFFFFF', borderColor: '#D7E2EA' }, darkPalette)).toEqual({
      backgroundColor: darkPalette.surface,
      borderColor: darkPalette.border,
    });
  });

  it('preserves saturated brand fills', () => {
    const style = { backgroundColor: '#D45B92' };
    expect(adaptThemeSurfaceStyle(style, darkPalette)).toBe(style);
  });
});
