import { authenticatedFetch } from '@services/apiClient';
import { BINAN_WEATHER_LOCATION } from '@hooks/useWeather';
import { getWeatherPresentation } from '@utils/weatherPresentation';
import type { LiveTyphoon } from '@types/weather';

type AdminDisaster = {
  name: string;
  description: string;
  severity: string;
  status: string;
  affected_areas: number;
};

type WeatherResponse = {
  current?: {
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    is_day: number;
  };
  hourly?: {
    time: string[];
    precipitation_probability: number[];
    precipitation: number[];
    weather_code: number[];
    wind_speed_10m: number[];
    wind_gusts_10m: number[];
    temperature_2m: number[];
  };
};

class SessionExpiredError extends Error {}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

async function fetchAdminDisasters(): Promise<AdminDisaster[]> {
  const response = await authenticatedFetch('/api/v1/disasters');
  if (response.status === 401) throw new SessionExpiredError('Your HANDA sign-in session has expired. Sign out and sign back in to check live disaster records.');
  if (!response.ok) throw new Error('HANDA disaster records are unavailable. Please sign in again or retry later.');
  return await response.json() as AdminDisaster[];
}

async function fetchLiveTyphoons(): Promise<LiveTyphoon[]> {
  const response = await authenticatedFetch('/api/v1/typhoons');
  if (response.status === 401) throw new SessionExpiredError('Your HANDA sign-in session has expired. Sign out and sign back in to check live cyclone reports.');
  if (!response.ok) throw new Error('The live cyclone feed is unavailable right now.');
  const result = await response.json() as { storms: LiveTyphoon[] };
  return result.storms;
}

function formatLiveTyphoon(typhoon: LiveTyphoon): string {
  const details = [typhoon.par_status];
  if (typhoon.max_wind_kmh !== null) details.push(`max sustained wind ${typhoon.max_wind_kmh} km/h`);
  if (typhoon.gust_speed_kmh !== null) details.push(`gusts ${typhoon.gust_speed_kmh} km/h`);
  if (typhoon.signal_no !== null) details.push(`PAGASA Signal No. ${typhoon.signal_no}`);
  return `Typhoon ${typhoon.international_name} (${details.join(', ')})`;
}

function isTyphoonEntry(disaster: AdminDisaster): boolean {
  return /typhoon|tropical cyclone|cyclone/i.test(`${disaster.name} ${disaster.description}`);
}

function formatAdminDisaster(disaster: AdminDisaster): string {
  const details = [`${disaster.status.toLowerCase()}, ${disaster.severity.toLowerCase()}`];
  if (disaster.affected_areas > 0) details.push(`${disaster.affected_areas} affected areas`);
  if (disaster.description.trim()) details.push(disaster.description.trim());
  return `${disaster.name} (${details.join('; ')})`;
}

async function answerTyphoonQuestion(question: string): Promise<string> {
  const asksUpcoming = hasAny(question, ['upcoming', 'expected', 'forecast', 'next', 'coming']);
  const [liveResult, adminResult] = await Promise.allSettled([fetchLiveTyphoons(), fetchAdminDisasters()]);
  const sessionExpired = [liveResult, adminResult].some((result) => result.status === 'rejected' && result.reason instanceof SessionExpiredError);
  if (sessionExpired) {
    return 'Your HANDA sign-in session has expired, so I could not verify current or upcoming typhoon records. Sign out and sign back in, then ask again. For official updates, check the PAGASA bulletin: https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin';
  }
  const liveTyphoons = liveResult.status === 'fulfilled' ? liveResult.value : null;
  const adminDisasters = adminResult.status === 'fulfilled' ? adminResult.value : null;
  const adminTyphoons = adminDisasters?.filter(isTyphoonEntry) ?? [];

  if (asksUpcoming) {
    const upcomingEntries = adminTyphoons.filter((disaster) => disaster.status.toLowerCase() === 'upcoming');
    const statements = [liveTyphoons === null
      ? 'I could not retrieve the live GDACS cyclone feed.'
      : 'The live GDACS feed reports active cyclones; it does not predict upcoming typhoons.'];
    if (upcomingEntries.length) statements.push(`HANDA admin upcoming entries: ${upcomingEntries.map(formatAdminDisaster).join('; ')}.`);
    else if (adminDisasters !== null) statements.push('There are no upcoming typhoons listed in HANDA admin records.');
    else statements.push('HANDA upcoming disaster records are unavailable.');
    if (liveTyphoons?.length) statements.push(`Currently active: ${liveTyphoons.map(formatLiveTyphoon).join('; ')}.`);
    if (!upcomingEntries.length) statements.push('Keep phones charged, prepare a go-bag, and review your evacuation route so you are ready if an advisory is issued.');
    return `${statements.join(' ')} Check PAGASA for official forecasts and warnings: https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin`;
  }

  const statements = [liveTyphoons === null
    ? 'I could not retrieve the live GDACS cyclone feed, so I cannot confirm current activity.'
    : liveTyphoons.length
      ? `Live GDACS active cyclones: ${liveTyphoons.map(formatLiveTyphoon).join('; ')}.`
      : 'GDACS currently reports no active tropical cyclones in its Western Pacific feed.'];
  const activeAdminEntries = adminTyphoons.filter((disaster) => disaster.status.toLowerCase() === 'active');
  if (activeAdminEntries.length) statements.push(`HANDA admin active entries: ${activeAdminEntries.map(formatAdminDisaster).join('; ')}.`);
  else if (adminDisasters !== null) statements.push('HANDA has no admin-entered active typhoon records.');
  else statements.push('HANDA admin disaster records are unavailable.');
  if (liveTyphoons?.length === 0 && activeAdminEntries.length === 0) {
    statements.push('There are no active typhoons reported by these sources right now. Keep monitoring PAGASA, charge your phone, and follow evacuation instructions if alerts change.');
  }
  statements.push('GDACS does not supply PAGASA signal numbers or gusts; check PAGASA for official warnings.');
  return statements.join(' ');
}

async function answerDisasterQuestion(): Promise<string> {
  try {
    const disasters = await fetchAdminDisasters();
    const relevant = disasters.filter((disaster) => ['active', 'upcoming'].includes(disaster.status.toLowerCase()));
    if (!relevant.length) return 'There are no active or upcoming disaster records in HANDA right now. Keep emergency contacts accessible, maintain a ready go-bag, and monitor official local advisories in case conditions change.';
    return `HANDA disaster records: ${relevant.map(formatAdminDisaster).join('; ')}.`;
  } catch (error) {
    return error instanceof Error ? error.message : 'HANDA disaster records are unavailable right now.';
  }
}

async function answerWeatherQuestion(question: string): Promise<string> {
  const query = new URLSearchParams({
    latitude: String(BINAN_WEATHER_LOCATION.latitude),
    longitude: String(BINAN_WEATHER_LOCATION.longitude),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day',
    hourly: 'precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,temperature_2m',
    forecast_hours: '24',
    timezone: 'auto',
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query.toString()}`);
  if (!response.ok) throw new Error('Biñan weather data is unavailable right now.');
  const result = await response.json() as WeatherResponse;
  if (!result.current || !result.hourly) throw new Error('Biñan weather data is incomplete right now.');

  const current = result.current;
  const presentation = getWeatherPresentation(current.weather_code, current.temperature_2m, current.is_day === 1);
  const hourly = result.hourly;
  const hours = hourly.time.map((time, index) => ({
    time: time.slice(11, 16),
    code: hourly.weather_code[index] ?? 0,
    rainProbability: hourly.precipitation_probability[index] ?? 0,
    precipitation: hourly.precipitation[index] ?? 0,
    wind: hourly.wind_speed_10m[index] ?? 0,
    gust: hourly.wind_gusts_10m[index] ?? 0,
    temperature: hourly.temperature_2m[index] ?? 0,
  }));
  const statements = [`Right now in Biñan: ${presentation.description}, ${Math.round(current.temperature_2m)}°C (feels like ${Math.round(current.apparent_temperature)}°C), humidity ${current.relative_humidity_2m}%, wind ${Math.round(current.wind_speed_10m)} km/h.`];
  const asksRain = hasAny(question, ['rain', 'shower', 'drizzle', 'flood']);
  const asksStorm = hasAny(question, ['thunder', 'lightning']);
  const asksWind = hasAny(question, ['wind', 'gust']);
  const asksHeat = hasAny(question, ['heat', 'hot', 'temperature']);
  const asksForecast = hasAny(question, ['forecast', 'upcoming', 'today', 'tomorrow', 'next', 'event', 'active']);
  const asksSky = hasAny(question, ['sunny', 'sunshine', 'clear sky', 'cloud', 'overcast']);

  if (asksForecast) {
    const rainHours = hours.filter((hour) => [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(hour.code) || hour.rainProbability >= 50).slice(0, 3);
    const stormHours = hours.filter((hour) => [95, 96, 99].includes(hour.code)).slice(0, 3);
    const windHours = hours.filter((hour) => hour.gust >= 50 || hour.wind >= 40).slice(0, 3);
    const heatHours = hours.filter((hour) => hour.temperature >= 35).slice(0, 3);
    const forecastEvents = [
      rainHours.length ? `rain/rain chance around ${rainHours.map((hour) => `${hour.time} (${hour.rainProbability}%)`).join(', ')}` : '',
      stormHours.length ? `thunderstorms around ${stormHours.map((hour) => hour.time).join(', ')}` : '',
      windHours.length ? `strong winds around ${windHours.map((hour) => `${hour.time} (gust ${Math.round(hour.gust)} km/h)`).join(', ')}` : '',
      heatHours.length ? `high heat around ${heatHours.map((hour) => `${hour.time} (${Math.round(hour.temperature)}°C)`).join(', ')}` : '',
    ].filter(Boolean);
    if (forecastEvents.length) {
      statements.push(`Upcoming Biñan model outlook: ${forecastEvents.join('; ')}.`);
    } else {
      statements.push('There are no significant rain, thunderstorm, strong-wind, or high-heat events forecast for Biñan in the next 24 hours. Keep a charged phone, check PAGASA before traveling, and avoid flooded roads if conditions change.');
    }
  } else {
    if (asksRain) {
      const rainHours = hours.filter((hour) => [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(hour.code) || hour.rainProbability >= 50).slice(0, 4);
      statements.push(rainHours.length
        ? `Rain or a significant rain chance appears around ${rainHours.map((hour) => `${hour.time} (${hour.rainProbability}%)`).join(', ')}.`
        : 'There is no significant rain forecast for Biñan in the next 24 hours. Carry water, check PAGASA updates before traveling, and avoid flooded roads if rain develops.');
    }
    if (asksStorm) {
      const stormHours = hours.filter((hour) => [95, 96, 99].includes(hour.code)).slice(0, 4);
      statements.push(stormHours.length
        ? `Thunderstorm conditions appear around ${stormHours.map((hour) => hour.time).join(', ')}.`
        : 'There are no thunderstorms forecast for Biñan in the next 24 hours. If lightning develops, go indoors and avoid exposed areas.');
    }
    if (asksWind) {
      const windHours = hours.filter((hour) => hour.gust >= 50 || hour.wind >= 40).slice(0, 4);
      statements.push(windHours.length
        ? `Stronger winds appear around ${windHours.map((hour) => `${hour.time} (gust ${Math.round(hour.gust)} km/h)`).join(', ')}.`
        : 'There are no strong-wind periods forecast for Biñan in the next 24 hours. Secure loose outdoor items if local conditions become gusty.');
    }
  }
  if (asksHeat || asksForecast) {
    const hottest = hours.reduce((maximum, hour) => hour.temperature > maximum.temperature ? hour : maximum, hours[0]);
    if (hottest) statements.push(`The forecast high for the next 24 hours is about ${Math.round(hottest.temperature)}°C around ${hottest.time}.`);
  }
  if (asksSky) {
    const skyHours = hours.filter((hour) => hour.code <= 3).slice(0, 4);
    statements.push(skyHours.length
      ? `Clear or cloudy conditions are modeled around ${skyHours.map((hour) => hour.time).join(', ')}.`
      : 'The hourly model does not show clear or cloudy sky codes in the next 24 hours.');
  }
  statements.push('This is a model outlook, not an official warning. Check PAGASA for advisories.');
  return statements.join(' ');
}

export async function answerQuestion(question: string): Promise<string> {
  const normalized = question.toLowerCase();
  if (hasAny(normalized, ['typhoon', 'tropical cyclone', 'cyclone'])) {
    return answerTyphoonQuestion(normalized);
  }
  if (hasAny(normalized, ['weather', 'rain', 'shower', 'drizzle', 'thunder', 'lightning', 'wind', 'gust', 'temperature', 'forecast', 'heat', 'sunny', 'sunshine', 'clear sky', 'cloud', 'overcast', 'humid', 'conditions'])) {
    try {
      return await answerWeatherQuestion(normalized);
    } catch (error) {
      return error instanceof Error ? error.message : 'Biñan weather data is unavailable right now.';
    }
  }
  if (hasAny(normalized, ['disaster', 'alert', 'active event'])) {
    try {
      return await answerDisasterQuestion();
    } catch (error) {
      return error instanceof Error ? error.message : 'HANDA disaster records are unavailable right now.';
    }
  }
  if (normalized.includes('report') || normalized.includes('incident')) {
    return 'Open Report incident from the resident Quick Actions, choose the incident type and severity, describe what happened, confirm your location, then post the report. Responders can acknowledge it and add response details.';
  }
  if (normalized.includes('flood') || normalized.includes('water')) {
    return 'Move to higher ground when warned, never walk or drive through moving floodwater, avoid downed power lines, and follow official evacuation instructions. Bring essential medication, water, a charged phone, and identification.';
  }
  if (normalized.includes('earthquake')) {
    return 'Drop, Cover, and Hold On. Stay away from windows and tall furniture, expect aftershocks, leave damaged buildings, and follow official instructions before returning.';
  }
  if (normalized.includes('fire')) {
    return 'Alert others, leave immediately using the safest exit, stay low under smoke, never use an elevator, call emergency services from a safe place, and do not re-enter.';
  }
  if (normalized.includes('status') || normalized.includes('checked') || normalized.includes('evacuat')) {
    return 'MY STATUS shows SAFE until an evacuation registration is checked in. It changes to CHECKED-IN, EVACUATED, or RELEASED as responders update your household registration.';
  }
  if (normalized.includes('household') || normalized.includes('member')) {
    return 'Tap HOUSEHOLD on the resident dashboard to add, edit, or remove household members. Changes are saved to the database immediately and are available during evacuation registration.';
  }
  if (normalized.includes('center') || normalized.includes('shelter')) {
    return 'Use Center status or the map to review evacuation centers, capacity, availability, and location. Choose a center that is accepting registrations.';
  }
  if (normalized.includes('responder') || normalized.includes('acknowledge') || normalized.includes('help')) {
    return 'Responders review live incident reports, acknowledge them, and can record people or organizations involved, an ETA, and response notes. The reporter receives the update in Alerts.';
  }
  if (normalized.includes('sos') || normalized.includes('emergency')) {
    return 'Use SOS for immediate assistance and hold the button for two seconds. For immediate danger, also contact the appropriate emergency service when possible.';
  }
  return 'I can help with current Biñan weather, forecast conditions, live typhoon reports, HANDA disaster entries, and app features. Try “Is there any typhoon right now?” or “Will it rain in Biñan today?”';
}

export type ChatbotTurn = { role: 'user' | 'assistant'; content: string };

export async function getLiveQuestionContext(question: string): Promise<string> {
  const normalized = question.toLowerCase();
  if (hasAny(normalized, ['typhoon', 'tropical cyclone', 'cyclone'])) return answerTyphoonQuestion(normalized);
  if (hasAny(normalized, ['weather', 'rain', 'shower', 'drizzle', 'thunder', 'lightning', 'wind', 'gust', 'temperature', 'forecast', 'heat', 'sunny', 'sunshine', 'clear sky', 'cloud', 'overcast', 'humid', 'conditions'])) {
    return answerWeatherQuestion(normalized);
  }
  if (hasAny(normalized, ['disaster', 'alert', 'active event'])) return answerDisasterQuestion();
  return '';
}

export async function requestModelAnswer(messages: ChatbotTurn[], context: string): Promise<string> {
  const response = await authenticatedFetch('/api/v1/chatbot/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context }),
  });
  const result = await response.json() as { answer?: string; detail?: string };
  if (!response.ok) throw new Error(result.detail || 'The AI assistant is unavailable right now.');
  if (!result.answer?.trim()) throw new Error('The AI assistant returned an empty answer.');
  return result.answer.trim();
}