export type LiveTyphoon = {
  id: string;
  international_name: string;
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