import { getReadableColor } from '../colors';

describe('dark theme text colors', () => {
  it('raises dark neutral text colors to a readable light tone', () => {
    expect(getReadableColor('#17212B', 'dark')).toBe('#F4F7F9');
  });

  it('preserves brand colors and all colors in light mode', () => {
    expect(getReadableColor('#D45B92', 'dark')).toBe('#D45B92');
    expect(getReadableColor('#17212B', 'light')).toBe('#17212B');
  });
});
