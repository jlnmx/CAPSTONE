/**
 * Supabase Realtime client. Only the public URL and publishable/anon key live in the app; the Realtime JWT is
 * minted by the HANDA API for the signed-in user and refreshed before it expires.
 */

import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { authenticatedFetch } from './apiClient';
import type { RealtimeClientLike } from './realtimeChannel';

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '')
  .trim()
  .replace(/\/rest\/v1\/?$/i, '')
  .replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const REFRESH_FRACTION = 0.75;

let client: SupabaseClient | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let pendingAuth: Promise<void> | null = null;
let tokenExpiresAt = 0;

export const isRealtimeConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export function getRealtimeClient(): RealtimeClientLike | null {
  if (!isRealtimeConfigured) return null;
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return client as unknown as RealtimeClientLike;
}

async function fetchAndApplyToken(): Promise<void> {
  const supabase = getRealtimeClient() as unknown as SupabaseClient | null;
  if (!supabase) throw new Error('Realtime is not configured.');
  const response = await authenticatedFetch('/api/v1/realtime/token', { method: 'POST' });
  if (!response.ok) throw new Error(`Realtime token request failed (${response.status}).`);
  const { token, expires_in: expiresIn } = (await response.json()) as { token: string; expires_in: number };
  await supabase.realtime.setAuth(token);
  tokenExpiresAt = Date.now() + expiresIn * 1000;

  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    void refreshRealtimeAuth(true).catch(() => undefined);
  }, expiresIn * 1000 * REFRESH_FRACTION);
}

/** Sets a valid JWT on the Realtime client. Concurrent callers share one request. */
export function refreshRealtimeAuth(force = false): Promise<void> {
  if (!force && tokenExpiresAt - Date.now() > 60_000) return Promise.resolve();
  pendingAuth ??= fetchAndApplyToken().finally(() => {
    pendingAuth = null;
  });
  return pendingAuth;
}

/** Call on logout: stops refresh, closes every channel and discards the token. */
export function disposeRealtime(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = undefined;
  tokenExpiresAt = 0;
  pendingAuth = null;
  const active = client;
  client = null;
  if (active) void active.removeAllChannels().catch(() => undefined);
}
