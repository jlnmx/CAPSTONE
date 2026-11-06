/**
 * Resilient private-channel subscription: waits for a fresh JWT, subscribes, retries with backoff on
 * errors, and removes the channel on close. Kept free of React and Supabase imports so it is testable.
 */

export interface ChannelLike {
  on(type: string, filter: Record<string, unknown>, callback: (message: any) => void): ChannelLike;
  subscribe(callback?: (status: string, error?: Error) => void): ChannelLike;
  track(payload: Record<string, unknown>): Promise<unknown>;
  send(message: { type: 'broadcast'; event: string; payload: unknown }): Promise<unknown>;
  presenceState(): Record<string, unknown[]>;
}

export interface RealtimeClientLike {
  channel(topic: string, options: { config: Record<string, unknown> }): ChannelLike;
  removeChannel(channel: ChannelLike): Promise<unknown> | unknown;
}

export interface ChannelSpec {
  topic: string;
  /** Presence key; also enables presence on the channel. */
  presenceKey?: string;
  broadcast?: Record<string, (payload: any) => void>;
  onPresenceSync?: (state: Record<string, any[]>) => void;
  onStatus?: (status: string) => void;
  /** Called with the live channel after it subscribes, and with null when it is torn down. */
  onChannel?: (channel: ChannelLike | null) => void;
}

export interface ChannelDeps {
  getClient: () => RealtimeClientLike | null;
  /** Resolves once the client holds a valid JWT; rejects if the token cannot be obtained. */
  refreshAuth: () => Promise<void>;
  maxRetryDelayMs?: number;
}

export function openChannel(deps: ChannelDeps, spec: ChannelSpec): () => void {
  const maxDelay = deps.maxRetryDelayMs ?? 30_000;
  let closed = false;
  let attempts = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let current: { client: RealtimeClientLike; channel: ChannelLike } | null = null;

  const teardown = () => {
    const active = current;
    current = null;
    if (active) {
      spec.onChannel?.(null);
      void Promise.resolve(active.client.removeChannel(active.channel)).catch(() => undefined);
    }
  };

  const scheduleRetry = () => {
    if (closed || timer) return;
    teardown();
    const delay = Math.min(maxDelay, 1000 * 2 ** attempts);
    attempts += 1;
    timer = setTimeout(() => {
      timer = undefined;
      void connect();
    }, delay);
  };

  const connect = async () => {
    if (closed) return;
    try {
      await deps.refreshAuth();
    } catch {
      spec.onStatus?.('AUTH_ERROR');
      scheduleRetry();
      return;
    }
    const client = deps.getClient();
    if (closed || !client) return;

    const channel = client.channel(spec.topic, {
      config: {
        private: true,
        broadcast: { self: false },
        ...(spec.presenceKey ? { presence: { key: spec.presenceKey } } : {}),
      },
    });
    for (const [event, handler] of Object.entries(spec.broadcast ?? {})) {
      channel.on('broadcast', { event }, (message) => handler(message?.payload));
    }
    if (spec.onPresenceSync) {
      channel.on('presence', { event: 'sync' }, () => spec.onPresenceSync?.(channel.presenceState() as Record<string, any[]>));
    }
    current = { client, channel };
    channel.subscribe((status) => {
      if (closed || current?.channel !== channel) return;
      spec.onStatus?.(status);
      if (status === 'SUBSCRIBED') {
        attempts = 0;
        spec.onChannel?.(channel);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        scheduleRetry();
      }
    });
  };

  void connect();

  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    timer = undefined;
    teardown();
  };
}
