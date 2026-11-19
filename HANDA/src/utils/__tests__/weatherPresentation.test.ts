import { getWeatherPresentation, getWeatherTileTimePresentation } from '../weatherPresentation';

describe('weather tile presentation', () => {
  it.each([
    [6, 'Morning'],
    [11, 'Noon'],
    [14, 'Afternoon'],
    [18, 'Evening'],
    [0, 'Evening'],
  ])('uses the %s-hour daypart palette', (hour, label) => {
    const time = new Date(2026, 0, 1, hour);
    expect(getWeatherTileTimePresentation(time).label).toBe(label);
    expect(getWeatherTileTimePresentation(time).gradient).toHaveLength(3);
  });

  it('uses condition-specific icons for clouds, rain, drizzle, and thunderstorms', () => {
    expect(getWeatherPresentation('CLOUDY', 25, true).icon).toBe('weather-cloudy');
    expect(getWeatherPresentation('RAIN', 25, true).icon).toBe('weather-rainy');
    expect(getWeatherPresentation('DRIZZLE', 25, true)).toMatchObject({
      icon: 'weather-rainy',
      tileIcon: 'weather-cloudy',
      overlayIcon: 'water',
    });
    expect(getWeatherPresentation('THUNDERSTORMS', 25, true).icon).toBe('weather-lightning-rainy');
  });
});
