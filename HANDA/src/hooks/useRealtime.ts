/**
 * React hooks for Supabase Realtime. Channels open only for a signed-in, non-demo user, are private,
 * retry on error, and are removed on unmount or logout.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@hooks/useAuth';
import { getRealtimeClient, isRealtimeConfigured, refreshRealtimeAuth } from '@services/realtimeClient';
import { ChannelLike, ChannelSpec, openChannel } from '@services/realtimeChannel';
import { createLocationPublisher, mergeResponderLive, parseLocation, presencePayload } from '@services/responderLive';
import {
  CENTER_EVENT,
  CenterChange,
  EVACUATION_CENTERS_TOPIC,
  INCIDENTS_TOPIC,
  INCIDENT_EVENT,
  IncidentChange,
  LOCATION_EVENT,
  NOTIFICATION_EVENT,
  NotificationCreated,
  RESPONDERS_TOPIC,
  RESPONDER_LIVE_ROLES,
  ResponderAvailability,
  ResponderLocation,
  notificationsTopic,
} from '@services/realtimeTopics';

const deps = { getClient: getRealtimeClient, refreshAuth: () => refreshRealtimeAuth() };

export type RealtimeStatus = 'idle' | 'connecting' | 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED' | 'AUTH_ERROR';

/** Subscribes while `enabled` and the topic stays the same; handlers may change without resubscribing. */
export function useRealtimeChannel(spec: ChannelSpec & { enabled: boolean }): { status: RealtimeStatus; channel: ChannelLike | null } {
  const [status, setStatus] = useState<RealtimeStatus>('idle');
  const [channel, setChannel] = useState<ChannelLike | null>(null);
  const specRef = useRef(spec);
  specRef.current = spec;
  const { enabled, topic, presenceKey } = spec;
  const eventNames = Object.keys(spec.broadcast ?? {}).join(',');
  const hasPresence = Boolean(spec.onPresenceSync);

  useEffect(() => {
    if (!enabled || !isRealtimeConfigured) return undefined;
    setStatus('connecting');
    const broadcast = Object.fromEntries(
      eventNames.split(',').filter(Boolean).map((event) => [event, (payload: unknown) => specRef.current.broadcast?.[event]?.(payload)]),
    );
    const close = openChannel(deps, {
      topic,
      presenceKey,
      broadcast,
      onPresenceSync: hasPresence ? (state) => specRef.current.onPresenceSync?.(state) : undefined,
      onStatus: (next) => {
        setStatus(next as RealtimeStatus);
        specRef.current.onStatus?.(next);
      },
      onChannel: setChannel,
    });
    return () => {
      close();
      setChannel(null);
      setStatus('idle');
    };
  }, [enabled, topic, presenceKey, eventNames, hasPresence]);

  return { status, channel };
}

function useRealtimeEnabled(roles?: readonly string[]) {
  const { user } = useAuth();
  const enabled = Boolean(user && !user.isDemo && (!roles || roles.includes(user.role)));
  return { user, enabled };
}

export function useIncidentFeed(onChange: (change: IncidentChange) => void) {
  const { enabled } = useRealtimeEnabled();
  return useRealtimeChannel({ enabled, topic: INCIDENTS_TOPIC, broadcast: { [INCIDENT_EVENT]: onChange } });
}

export function useEvacuationCenterFeed(onChange: (change: CenterChange) => void) {
  const { enabled } = useRealtimeEnabled();
  return useRealtimeChannel({ enabled, topic: EVACUATION_CENTERS_TOPIC, broadcast: { [CENTER_EVENT]: onChange } });
}

/** Residents and responders only; the topic embeds the signed-in user's id and the database enforces it. */
export function useNotificationStream(onNotification: (event: NotificationCreated) => void) {
  const { user, enabled } = useRealtimeEnabled(['resident', 'responder']);
  return useRealtimeChannel({
    enabled,
    topic: notificationsTopic(user?.id ?? ''),
    broadcast: { [NOTIFICATION_EVENT]: onNotification },
  });
}

/**
 * Responders publish availability and location; admins and responders see who is online and where.
 * Everything is transient: Presence holds who is online, Broadcast carries throttled locations.
 */
export function useResponderLive() {
  const { user, enabled } = useRealtimeEnabled(RESPONDER_LIVE_ROLES);
  const canShare = user?.role === 'responder';
  const [presence, setPresence] = useState<Record<string, any[]>>({});
  const [locations, setLocations] = useState<Record<string, ResponderLocation>>({});
  const availabilityRef = useRef<ResponderAvailability>('available');

  const onLocation = useCallback((payload: unknown) => {
    const location = parseLocation(payload);
    if (location) setLocations((current) => ({ ...current, [location.user_id]: location }));
  }, []);

  const onPresenceSync = useCallback((state: Record<string, any[]>) => {
    setPresence(state);
    setLocations((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id in state)));
  }, []);

  const { status, channel } = useRealtimeChannel({
    enabled,
    topic: RESPONDERS_TOPIC,
    presenceKey: canShare ? user?.id : undefined,
    broadcast: { [LOCATION_EVENT]: onLocation },
    onPresenceSync,
  });

  useEffect(() => {
    if (channel && canShare) void channel.track(presencePayload(availabilityRef.current) as unknown as Record<string, unknown>).catch(() => undefined);
  }, [channel, canShare]);

  const setAvailability = useCallback((availability: ResponderAvailability) => {
    availabilityRef.current = availability;
    if (channel && canShare) void channel.track(presencePayload(availability) as unknown as Record<string, unknown>).catch(() => undefined);
  }, [channel, canShare]);

  const channelRef = useRef<ChannelLike | null>(null);
  channelRef.current = channel;
  const publishLocation = useMemo(
    () => (canShare && user ? createLocationPublisher(() => channelRef.current, user.id) : () => false),
    [canShare, user],
  );

  const responders = useMemo(() => mergeResponderLive(presence, locations), [presence, locations]);
  return { status, responders, setAvailability, publishLocation };
}
