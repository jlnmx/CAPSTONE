import { useEffect, useMemo, useState } from 'react';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { apiRequest } from './api';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL?.trim() || '')
  .replace(/\/rest\/v1\/?$/i, '')
  .replace(/\/+$/, '');
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';
const LOCATION_STALE_MS = 60_000;

interface ResponderLocation {
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  city?: string;
  barangay?: string;
  ts: number;
}

interface LiveResponder {
  user_id: string;
  availability: 'available' | 'busy';
  online_at: string;
  location?: ResponderLocation;
}

type LivePresenceApiStatus = 'connecting' | 'ready' | 'error';

type LivePresence = { availability?: string; online_at?: string };

let client: SupabaseClient | null = null;
let tokenExpiresAt = 0;
let pendingToken: Promise<void> | null = null;

function getClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return client;
}

function getErrorSummary(error: unknown): string {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
      ? error.message
      : '';
  return message
    .replace(/https?:\/\/\S+/gi, 'service URL')
    .replace(/wss?:\/\/\S+/gi, 'Realtime endpoint')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .slice(0, 180);
}

async function refreshRealtimeAuth(force = false): Promise<void> {
  const supabase = getClient();
  if (!supabase) throw new Error('Realtime is not configured for the Command Center.');
  if (!force && tokenExpiresAt - Date.now() > 60_000) return;
  pendingToken ??= apiRequest<{ token: string; expires_in: number }>('/api/v1/realtime/token', { method: 'POST' })
    .then(async ({ token, expires_in: expiresIn }) => {
      await supabase.realtime.setAuth(token);
      tokenExpiresAt = Date.now() + expiresIn * 1000;
    })
    .finally(() => { pendingToken = null; });
  await pendingToken;
}

function parseLocation(payload: unknown): ResponderLocation | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const value = payload as Record<string, unknown>;
  const { user_id: userId, latitude, longitude, accuracy, ts } = value;
  const city = typeof value.city === 'string' ? value.city.trim().slice(0, 100) : '';
  const barangay = typeof value.barangay === 'string' ? value.barangay.trim().slice(0, 100) : '';
  const isBinan = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('binan');
  if (typeof userId !== 'string'
    || typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return {
    user_id: userId,
    latitude,
    longitude,
    ...(typeof accuracy === 'number' ? { accuracy } : {}),
    ...(city ? { city } : {}),
    ...(isBinan && barangay ? { barangay } : {}),
    ts: typeof ts === 'number' && Number.isFinite(ts) ? ts : Date.now(),
  };
}

function mergeResponders(
  presence: Record<string, LivePresence[]>,
  locations: Record<string, ResponderLocation>,
  now: number,
): Record<string, LiveResponder> {
  const result: Record<string, LiveResponder> = {};
  for (const [userId, entries] of Object.entries(presence)) {
    const meta = entries[entries.length - 1];
    if (!meta) continue;
    const location = locations[userId];
    result[userId] = {
      user_id: userId,
      availability: meta.availability === 'busy' ? 'busy' : 'available',
      online_at: meta.online_at ?? '',
      ...(location && now - location.ts <= LOCATION_STALE_MS ? { location } : {}),
    };
  }
  return result;
}

export function useResponderLive() {
  const [presence, setPresence] = useState<Record<string, LivePresence[]>>({});
  const [locations, setLocations] = useState<Record<string, ResponderLocation>>({});
  const [status, setStatus] = useState('connecting');
  const [errorMessage, setErrorMessage] = useState('');
  const [now, setNow] = useState(Date.now);
  const [apiResponders, setApiResponders] = useState<Record<string, LiveResponder>>({});
  const [apiStatus, setApiStatus] = useState<LivePresenceApiStatus>('connecting');
  const [apiErrorMessage, setApiErrorMessage] = useState('');
  const responders = useMemo(
    () => ({ ...apiResponders, ...mergeResponders(presence, locations, now) }),
    [apiResponders, presence, locations, now],
  );

  useEffect(() => {
    let active = true;
    const refreshApiPresence = async () => {
      try {
        const rows = await apiRequest<unknown[]>('/api/v1/responders/live');
        if (!active) return;
        const next: Record<string, LiveResponder> = {};
        for (const row of rows) {
          if (typeof row !== 'object' || row === null) continue;
          const value = row as Record<string, unknown>;
          if (typeof value.user_id !== 'string' || typeof value.online_at !== 'string') continue;
          const location = parseLocation(value.location);
          next[value.user_id] = {
            user_id: value.user_id,
            availability: value.availability === 'busy' ? 'busy' : 'available',
            online_at: value.online_at,
            ...(location ? { location } : {}),
          };
        }
        setApiResponders(next);
        setApiStatus('ready');
        setApiErrorMessage('');
      } catch (error) {
        if (!active) return;
        setApiStatus('error');
        setApiErrorMessage(getErrorSummary(error));
      }
    };
    void refreshApiPresence();
    const apiTimer = window.setInterval(() => void refreshApiPresence(), 15_000);

    const supabase = getClient();
    if (!supabase) {
      setStatus('NOT_CONFIGURED');
      return () => {
        active = false;
        window.clearInterval(apiTimer);
      };
    }

    let channel: RealtimeChannel | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let tokenTimer: ReturnType<typeof setTimeout> | undefined;

    const scheduleTokenRefresh = () => {
      if (tokenTimer) clearTimeout(tokenTimer);
      const refreshIn = Math.max(10_000, (tokenExpiresAt - Date.now()) * 0.75);
      tokenTimer = setTimeout(() => {
        void refreshRealtimeAuth(true)
          .then(scheduleTokenRefresh)
          .catch((error: unknown) => {
            setStatus('AUTH_ERROR');
            setErrorMessage(getErrorSummary(error));
          });
      }, refreshIn);
    };

    const connect = async () => {
      try {
        await refreshRealtimeAuth();
        if (!active) return;
        if (channel) void supabase.removeChannel(channel);
        const nextChannel = supabase.channel('responders:live', {
          config: { private: true, broadcast: { self: false } },
        });
        nextChannel
          .on('presence', { event: 'sync' }, () => {
            const state = nextChannel.presenceState();
            const nextPresence: Record<string, LivePresence[]> = {};
            for (const [userId, entries] of Object.entries(state)) {
              nextPresence[userId] = entries.map((entry) => {
                const availability = Reflect.get(entry, 'availability');
                const onlineAt = Reflect.get(entry, 'online_at');
                return {
                  availability: typeof availability === 'string' ? availability : undefined,
                  online_at: typeof onlineAt === 'string' ? onlineAt : undefined,
                };
              });
            }
            setPresence(nextPresence);
            setLocations((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id in nextPresence)));
          })
          .on('broadcast', { event: 'location' }, (message) => {
            const location = parseLocation(message.payload);
            if (location) setLocations((current) => ({ ...current, [location.user_id]: location }));
          })
          .subscribe((nextStatus, error) => {
            if (!active) return;
            setStatus(nextStatus);
            if (nextStatus === 'SUBSCRIBED') setErrorMessage('');
            else if (error) setErrorMessage(getErrorSummary(error));
            if (nextStatus === 'SUBSCRIBED' && retryTimer) {
              clearTimeout(retryTimer);
              retryTimer = undefined;
            }
            if (nextStatus === 'CHANNEL_ERROR' || nextStatus === 'TIMED_OUT' || nextStatus === 'CLOSED') {
              if (!retryTimer) retryTimer = setTimeout(() => {
                retryTimer = undefined;
                void connect();
              }, 2000);
            }
          });
        channel = nextChannel;
        scheduleTokenRefresh();
      } catch {
        if (!active) return;
        setStatus('AUTH_ERROR');
        setErrorMessage('Could not obtain a Realtime access token.');
        if (!retryTimer) retryTimer = setTimeout(() => {
          retryTimer = undefined;
          void connect();
        }, 5000);
      }
    };

    void connect();
    const clock = setInterval(() => setNow(Date.now()), 5000);
    return () => {
      active = false;
      clearInterval(clock);
      window.clearInterval(apiTimer);
      if (retryTimer) clearTimeout(retryTimer);
      if (tokenTimer) clearTimeout(tokenTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  return { responders, status, errorMessage, apiStatus, apiErrorMessage };
}
