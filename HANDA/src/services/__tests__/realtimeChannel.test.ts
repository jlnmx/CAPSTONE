import { ChannelLike, RealtimeClientLike, openChannel } from '../realtimeChannel';
import { notificationsTopic } from '../realtimeTopics';

class FakeChannel implements ChannelLike {
  handlers: Record<string, (message: any) => void> = {};
  statusCallback?: (status: string) => void;
  constructor(readonly topic: string, readonly options: any) {}
  on(type: string, filter: Record<string, unknown>, callback: (message: any) => void) {
    this.handlers[`${type}:${(filter as any).event}`] = callback;
    return this;
  }
  subscribe(callback?: (status: string) => void) {
    this.statusCallback = callback;
    return this;
  }
  track = jest.fn(async () => undefined);
  send = jest.fn(async () => undefined);
  presenceState = () => ({});
}

function createFakeClient() {
  const channels: FakeChannel[] = [];
  const client: RealtimeClientLike = {
    channel: (topic, options) => {
      const channel = new FakeChannel(topic, options);
      channels.push(channel);
      return channel;
    },
    removeChannel: jest.fn(async () => undefined),
  };
  return { client, channels };
}

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

describe('openChannel', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('refreshes the JWT before joining a private channel and delivers broadcast payloads', async () => {
    const { client, channels } = createFakeClient();
    const order: string[] = [];
    const refreshAuth = jest.fn(async () => { order.push('auth'); });
    const onEvent = jest.fn();
    openChannel(
      { getClient: () => { order.push('client'); return client; }, refreshAuth },
      { topic: 'incidents:feed', broadcast: { incident_changed: onEvent } },
    );
    await flush();

    expect(order).toEqual(['auth', 'client']);
    expect(channels[0].topic).toBe('incidents:feed');
    expect(channels[0].options.config.private).toBe(true);
    channels[0].handlers['broadcast:incident_changed']({ payload: { op: 'INSERT', incident: { id: 'i1' } } });
    expect(onEvent).toHaveBeenCalledWith({ op: 'INSERT', incident: { id: 'i1' } });
  });

  it('removes the channel on close and ignores later events and retries', async () => {
    const { client, channels } = createFakeClient();
    const onStatus = jest.fn();
    const close = openChannel({ getClient: () => client, refreshAuth: async () => undefined }, { topic: 'x', onStatus });
    await flush();
    channels[0].statusCallback?.('SUBSCRIBED');

    close();
    expect(client.removeChannel).toHaveBeenCalledWith(channels[0]);
    channels[0].statusCallback?.('CHANNEL_ERROR');
    jest.advanceTimersByTime(60_000);
    await flush();
    expect(channels).toHaveLength(1);
    expect(onStatus).toHaveBeenCalledTimes(1);
  });

  it('closing before auth resolves never creates a channel', async () => {
    const { client, channels } = createFakeClient();
    let release!: () => void;
    const close = openChannel(
      { getClient: () => client, refreshAuth: () => new Promise<void>((resolve) => { release = resolve; }) },
      { topic: 'x' },
    );
    close();
    release();
    await flush();
    expect(channels).toHaveLength(0);
  });

  it('retries with backoff and a fresh token after a channel error', async () => {
    const { client, channels } = createFakeClient();
    const refreshAuth = jest.fn(async () => undefined);
    openChannel({ getClient: () => client, refreshAuth }, { topic: 'x' });
    await flush();
    channels[0].statusCallback?.('CHANNEL_ERROR');
    expect(client.removeChannel).toHaveBeenCalledWith(channels[0]);

    jest.advanceTimersByTime(999);
    await flush();
    expect(channels).toHaveLength(1);
    jest.advanceTimersByTime(1);
    await flush();
    expect(channels).toHaveLength(2);
    expect(refreshAuth).toHaveBeenCalledTimes(2);
  });

  it('does not subscribe when the token cannot be obtained and retries later', async () => {
    const { client, channels } = createFakeClient();
    const refreshAuth = jest.fn().mockRejectedValueOnce(new Error('401')).mockResolvedValue(undefined);
    const onStatus = jest.fn();
    openChannel({ getClient: () => client, refreshAuth }, { topic: 'x', onStatus });
    await flush();
    expect(channels).toHaveLength(0);
    expect(onStatus).toHaveBeenCalledWith('AUTH_ERROR');
    jest.advanceTimersByTime(1000);
    await flush();
    expect(channels).toHaveLength(1);
  });

  it('enables presence only when a key is provided', async () => {
    const { client, channels } = createFakeClient();
    openChannel({ getClient: () => client, refreshAuth: async () => undefined }, { topic: 'responders:live', presenceKey: 'r1', onPresenceSync: jest.fn() });
    await flush();
    expect(channels[0].options.config.presence).toEqual({ key: 'r1' });
    expect(channels[0].handlers['presence:sync']).toBeDefined();
  });
});

describe('topics', () => {
  it('scopes notification topics to a single user id', () => {
    expect(notificationsTopic('abc')).toBe('user:abc:notifications');
  });
});
