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
  if (code >= 95) return { description: 'Thunderstorms', icon: 'weather-lightning-rainy', tip: 'Stay indoors during lightning and keep emergency equipment charged.', accent: '#D63F43', gradient: ['#273B63', '#5D6F9A', '#D4A56A'], backgroundIcon: 'weather-cloudy' };
  if (code >= 80) return { description: 'Rain showers', icon: 'weather-pouring', tip: 'Watch water levels and avoid unnecessary travel during heavy rain.', accent: '#2873A8', gradient: ['#31506B', '#5F88A4', '#B8C9D1'], backgroundIcon: 'weather-cloudy' };
  if (code >= 61) return { description: 'Light rain', icon: 'weather-rainy', tip: 'Carry rain protection and check local advisories before travelling.', accent: '#2873A8', gradient: ['#345C70', '#6D9AA8', '#C2D7D4'], backgroundIcon: 'weather-cloudy' };
  if (code >= 51) return { description: 'Drizzle', icon: 'weather-partly-rainy', tip: 'Visibility may be reduced. Allow extra time when travelling.', accent: '#2873A8', gradient: ['#4A6670', '#87A8A8', '#D2DED7'], backgroundIcon: 'weather-cloudy' };
  if (code === 45 || code === 48) return { description: 'Foggy', icon: 'weather-fog', tip: 'Use caution on the road and keep lights on in poor visibility.', accent: '#687D8A', gradient: ['#52636B', '#8E9BA0', '#D5D6CC'], backgroundIcon: 'weather-cloudy' };
  if (temperature >= 34) return { description: 'Very hot and clear', icon: 'weather-sunny-alert', tip: 'Stay hydrated, limit midday exposure, and watch for heat stress.', accent: '#D97725', gradient: ['#8D4B2C', '#D37A39', '#F0C66E'], backgroundIcon: 'weather-cloudy' };
  if (code >= 2) return { description: isDay ? 'Partly cloudy' : 'Cloudy night', icon: 'weather-partly-cloudy', tip: 'Conditions are changeable. Continue monitoring official updates.', accent: '#D98C18', gradient: ['#48636C', '#7B9A9A', '#D1C58B'], backgroundIcon: 'weather-cloudy' };
  return { description: isDay ? 'Clear skies' : 'Clear night', icon: isDay ? 'weather-sunny' : 'weather-night', tip: isDay ? 'Visibility is good. Keep your emergency contacts ready.' : 'Keep devices charged and stay alert for overnight advisories.', accent: '#D98C18', gradient: isDay ? ['#2B6F68', '#5AA081', '#E5C767'] : ['#1F3154', '#405B7C', '#8CA6BA'], backgroundIcon: 'weather-cloudy' };
}