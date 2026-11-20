import { getWeatherPresentation, getWeatherTileIcon, getWeatherTileTimePresentation } from '../weatherPresentation';

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

  it('uses moon-based icons for clear and partly cloudy current conditions in the evening', () => {
    const evening = new Date(2026, 0, 1, 19);
    const afternoon = new Date(2026, 0, 1, 15);
    const partlyCloudy = getWeatherPresentation('CLOUDY', 25, true, 'Mostly cloudy');
    const clear = getWeatherPresentation('CLEAR', 25, true);

    expect(getWeatherTileIcon(partlyCloudy, evening)).toBe('weather-night-partly-cloudy');
    expect(getWeatherTileIcon(clear, evening)).toBe('weather-night');
    expect(getWeatherTileIcon(partlyCloudy, afternoon)).toBe('weather-partly-cloudy');
  });
});
