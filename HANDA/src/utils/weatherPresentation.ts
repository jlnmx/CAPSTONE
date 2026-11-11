import { MaterialCommunityIcons } from '@expo/vector-icons';

export type WeatherPresentation = {
  description: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  tip: string;
  accent: string;
  gradient: [string, string, string];
  backgroundIcon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  hazard: 'thunderstorm' | 'rain' | 'heat' | 'general';
};

export function getSafetyTip(presentation: WeatherPresentation, timeLabel: string, disasterActive: boolean) {
  if (disasterActive) return { title: 'Active disaster advisory', detail: 'Follow official instructions, keep your phone charged, and be ready to move to a safe location.' };
  if (presentation.hazard === 'thunderstorm') return { title: `${timeLabel} lightning advisory`, detail: 'Stay indoors during lightning and keep emergency equipment charged.' };
  if (presentation.hazard === 'rain') return { title: `${timeLabel} rain advisory`, detail: presentation.tip };
  if (presentation.hazard === 'heat') return { title: `${timeLabel} heat advisory`, detail: presentation.tip };
  return { title: `${timeLabel} safety tip`, detail: presentation.tip };
}

export function getWeatherPresentation(conditionType: string, temperature: number, isDay: boolean, conditionDescription?: string): WeatherPresentation {
  const type = conditionType.toUpperCase();
  const description = conditionDescription?.trim();
  if (/THUNDER|HAIL/.test(type)) return { description: description || 'Thunderstorms', icon: 'weather-lightning-rainy', tip: 'Stay indoors during lightning and keep emergency equipment charged.', accent: '#D63F43', gradient: ['#273B63', '#5D6F9A', '#D4A56A'], backgroundIcon: 'weather-lightning-rainy', hazard: 'thunderstorm' };
  if (type.includes('SNOW') || type.includes('ICE')) return { description: description || 'Snow', icon: 'weather-snowy-heavy', tip: 'Avoid unnecessary travel and follow local weather advisories.', accent: '#527D9B', gradient: ['#344B62', '#66849A', '#B8CBD5'], backgroundIcon: 'weather-snowy-heavy', hazard: 'general' };
  if (/RAIN|SHOWERS/.test(type)) return { description: description || 'Rain', icon: type.includes('HEAVY') ? 'weather-pouring' : 'weather-rainy', tip: 'Watch water levels and avoid unnecessary travel during heavy rain.', accent: '#2873A8', gradient: ['#253D56', '#456B88', '#91B3C7'], backgroundIcon: 'weather-pouring', hazard: 'rain' };
  if (type.includes('FOG')) return { description: description || 'Foggy', icon: 'weather-fog', tip: 'Use caution on the road and keep lights on in poor visibility.', accent: '#687D8A', gradient: ['#52636B', '#8E9BA0', '#D5D6CC'], backgroundIcon: 'weather-cloudy', hazard: 'general' };
  if (type.includes('WIND')) return { description: description || 'Windy', icon: 'weather-windy', tip: 'Secure loose outdoor items and monitor local advisories.', accent: '#557A96', gradient: ['#263D55', '#486B89', '#91AFC1'], backgroundIcon: 'weather-windy', hazard: 'general' };
  if (type.includes('CLOUDY')) return { description: description || (isDay ? 'Cloudy' : 'Cloudy night'), icon: type.includes('PARTLY') ? 'weather-partly-cloudy' : 'weather-cloudy', tip: 'Conditions are changeable. Continue monitoring official updates.', accent: '#557A96', gradient: isDay ? ['#263D55', '#486B89', '#91AFC1'] : ['#192B40', '#354E68', '#6D879B'], backgroundIcon: 'weather-cloudy', hazard: 'general' };
  if (temperature >= 35) return { description: description || 'Very hot', icon: 'weather-sunny-alert', tip: 'Stay hydrated, limit midday exposure, and watch for heat stress.', accent: '#D97725', gradient: ['#8D4B2C', '#D37A39', '#F0C66E'], backgroundIcon: 'weather-sunny-alert', hazard: 'heat' };
  return { description: description || (isDay ? 'Clear skies' : 'Clear night'), icon: isDay ? 'weather-sunny' : 'weather-night', tip: isDay ? 'Visibility is good. Keep your emergency contacts ready.' : 'Keep devices charged and stay alert for overnight advisories.', accent: '#D98C18', gradient: isDay ? ['#2B6F68', '#5AA081', '#E5C767'] : ['#1F3154', '#405B7C', '#8CA6BA'], backgroundIcon: isDay ? 'weather-sunny' : 'weather-night', hazard: 'general' };
}
