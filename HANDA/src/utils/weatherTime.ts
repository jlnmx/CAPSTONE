export function getTimeOfDayPresentation(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 7) return { label: 'Dawn', icon: 'weather-sunset-up' as const, background: '#A85F4B', accent: '#F0A47D', indicator: '#F9D5B8', pageBackground: '#F7E9E2' };
  if (hour >= 7 && hour < 12) return { label: 'Morning', icon: 'weather-sunny' as const, background: '#397E8E', accent: '#F2C66D', indicator: '#FFE6A6', pageBackground: '#E9F2EC' };
  if (hour >= 12 && hour < 17) return { label: 'Afternoon', icon: 'weather-sunny' as const, background: '#347B69', accent: '#F1C75B', indicator: '#FFE08B', pageBackground: '#E5F0E8' };
  if (hour >= 17 && hour < 19) return { label: 'Dusk', icon: 'weather-sunset' as const, background: '#845A54', accent: '#F1A06D', indicator: '#F8D2A0', pageBackground: '#F0E4DF' };
  return { label: 'Night', icon: 'weather-night' as const, background: '#344A68', accent: '#9BB9D3', indicator: '#D6E7F2', pageBackground: '#E5EAF0' };
}

export function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}