export type EnvironmentalRisk = {
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
  airQualityFactor: string;
  weatherFactor: string;
  basis: string;
};

export type WeatherCurrent = {
  time: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  conditionType: string;
  conditionDescription: string;
  isDay: boolean;
};

export type WeatherHour = {
  time: string;
  temperature: number;
  precipitationProbability: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  windGust: number | null;
  thunderstormProbability: number | null;
  conditionType: string;
  conditionDescription: string;
  isDay: boolean;
};

export type WeatherDay = {
  date: string;
  conditionType: string;
  conditionDescription: string;
  minTemperature: number;
  maxTemperature: number;
  precipitationSum: number | null;
  precipitationProbability: number | null;
  windSpeedMax: number | null;
};

export type GoogleWeatherSnapshot = {
  current: WeatherCurrent;
  hourly: WeatherHour[];
  daily: WeatherDay[];
  airQualityAvailable: boolean;
  environmentalRisk: EnvironmentalRisk | null;
};

export type LiveTyphoon = {
  id: string;
  international_name: string;
  classification: 'Low Pressure Area' | 'Tropical Depression' | 'Tropical Storm' | 'Severe Tropical Storm' | 'Typhoon' | 'Super Typhoon' | 'Unclassified';
  status: 'Active';
  latitude: number;
  longitude: number;
  par_status: 'Inside PAR' | 'Outside PAR';
  signal_no: number | null;
  max_wind_kmh: number | null;
  gust_speed_kmh: number | null;
  data_source: string;
  source_url: string;
  updated_at: string | null;
};

export type LiveTyphoonReport = {
  source: string;
  source_url: string;
  status: string;
  laguna_signal_no: number | null;
  checked_at: string;
  storms: LiveTyphoon[];
};