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