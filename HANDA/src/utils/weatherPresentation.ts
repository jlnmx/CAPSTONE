import { MaterialCommunityIcons } from '@expo/vector-icons';

export type WeatherPresentation = {
  description: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  tip: string;
  accent: string;
  gradient: [string, string, string];
  backgroundIcon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
};

export function getSafetyTip(presentation: WeatherPresentation, timeLabel: string, disasterActive: boolean) {
  if (disasterActive) return { title: 'Active disaster advisory', detail: 'Follow official instructions, keep your phone charged, and be ready to move to a safe location.' };
  if (presentation.description === 'Thunderstorms') return { title: `${timeLabel} lightning advisory`, detail: 'Stay indoors, avoid exposed areas, and keep emergency contacts ready.' };
  if (presentation.description.includes('rain') || presentation.description === 'Drizzle') return { title: `${timeLabel} rain advisory`, detail: presentation.tip };
  if (presentation.description === 'Very hot and clear') return { title: `${timeLabel} heat advisory`, detail: presentation.tip };
  return { title: `${timeLabel} safety tip`, detail: presentation.tip };
}

export function getWeatherPresentation(code: number, temperature: number, isDay: boolean): WeatherPresentation {
  if ([95, 96, 99].includes(code)) return { description: 'Thunderstorms', icon: 'weather-lightning-rainy', tip: 'Stay indoors during lightning and keep emergency equipment charged.', accent: '#D63F43', gradient: ['#273B63', '#5D6F9A', '#D4A56A'], backgroundIcon: 'weather-lightning-rainy' };
  if ([85, 86].includes(code)) return { description: 'Snow showers', icon: 'weather-snowy-heavy', tip: 'Avoid unnecessary travel and follow local weather advisories.', accent: '#527D9B', gradient: ['#344B62', '#66849A', '#B8CBD5'], backgroundIcon: 'weather-snowy-heavy' };
  if ([80, 81, 82].includes(code)) return { description: 'Rain showers', icon: 'weather-pouring', tip: 'Watch water levels and avoid unnecessary travel during heavy rain.', accent: '#2873A8', gradient: ['#253D56', '#456B88', '#91B3C7'], backgroundIcon: 'weather-pouring' };
  if ([66, 67].includes(code)) return { description: 'Freezing rain', icon: 'weather-snowy-rainy', tip: 'Use caution outdoors and follow local weather advisories.', accent: '#527D9B', gradient: ['#344B62', '#66849A', '#B8CBD5'], backgroundIcon: 'weather-snowy-rainy' };
  if ([61, 63, 65].includes(code)) return { description: 'Rain', icon: 'weather-rainy', tip: 'Carry rain protection and check local advisories before travelling.', accent: '#2873A8', gradient: ['#2F506A', '#5F879D', '#A7C7D2'], backgroundIcon: 'weather-rainy' };
  if ([71, 73, 75, 77].includes(code)) return { description: 'Snow', icon: 'weather-snowy', tip: 'Avoid unnecessary travel and follow local weather advisories.', accent: '#527D9B', gradient: ['#344B62', '#66849A', '#B8CBD5'], backgroundIcon: 'weather-snowy' };
  if ([56, 57].includes(code)) return { description: 'Freezing drizzle', icon: 'weather-snowy-rainy', tip: 'Use caution outdoors and follow local weather advisories.', accent: '#527D9B', gradient: ['#3B5368', '#718D9F', '#BDCDD3'], backgroundIcon: 'weather-snowy-rainy' };
  if ([51, 53, 55].includes(code)) return { description: 'Drizzle', icon: 'weather-partly-rainy', tip: 'Visibility may be reduced. Allow extra time when travelling.', accent: '#2873A8', gradient: ['#3D596B', '#6E8F9D', '#B4C9CC'], backgroundIcon: 'weather-partly-rainy' };
  if (code === 45 || code === 48) return { description: 'Foggy', icon: 'weather-fog', tip: 'Use caution on the road and keep lights on in poor visibility.', accent: '#687D8A', gradient: ['#52636B', '#8E9BA0', '#D5D6CC'], backgroundIcon: 'weather-cloudy' };
  if (temperature >= 34 && code <= 1) return { description: 'Very hot and clear', icon: 'weather-sunny-alert', tip: 'Stay hydrated, limit midday exposure, and watch for heat stress.', accent: '#D97725', gradient: ['#8D4B2C', '#D37A39', '#F0C66E'], backgroundIcon: 'weather-sunny-alert' };
  if (code === 3) return { description: isDay ? 'Overcast' : 'Cloudy night', icon: 'weather-cloudy', tip: 'Conditions are changeable. Continue monitoring official updates.', accent: '#557A96', gradient: isDay ? ['#263D55', '#486B89', '#91AFC1'] : ['#192B40', '#354E68', '#6D879B'], backgroundIcon: 'weather-cloudy' };
  if (code === 2) return { description: isDay ? 'Partly cloudy' : 'Partly cloudy night', icon: 'weather-partly-cloudy', tip: 'Conditions are changeable. Continue monitoring official updates.', accent: '#D98C18', gradient: isDay ? ['#31546B', '#62879A', '#B7C9C6'] : ['#21364E', '#405D78', '#8CA6BA'], backgroundIcon: 'weather-partly-cloudy' };
  if (code === 1) return { description: isDay ? 'Mainly clear' : 'Mainly clear night', icon: isDay ? 'weather-partly-cloudy' : 'weather-night-partly-cloudy', tip: isDay ? 'Visibility is good. Keep your emergency contacts ready.' : 'Keep devices charged and stay alert for overnight advisories.', accent: '#D98C18', gradient: isDay ? ['#2B6F68', '#5AA081', '#E5C767'] : ['#1F3154', '#405B7C', '#8CA6BA'], backgroundIcon: isDay ? 'weather-partly-cloudy' : 'weather-night-partly-cloudy' };
  return { description: isDay ? 'Clear skies' : 'Clear night', icon: isDay ? 'weather-sunny' : 'weather-night', tip: isDay ? 'Visibility is good. Keep your emergency contacts ready.' : 'Keep devices charged and stay alert for overnight advisories.', accent: '#D98C18', gradient: isDay ? ['#2B6F68', '#5AA081', '#E5C767'] : ['#1F3154', '#405B7C', '#8CA6BA'], backgroundIcon: isDay ? 'weather-sunny' : 'weather-night' };
}