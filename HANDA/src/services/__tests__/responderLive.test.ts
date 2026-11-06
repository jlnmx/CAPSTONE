import { ChannelLike } from '../realtimeChannel';
import { createLocationPublisher, mergeResponderLive, parseLocation } from '../responderLive';

const fakeChannel = () => ({ send: jest.fn(async () => undefined) } as unknown as ChannelLike & { send: jest.Mock });

describe('parseLocation', () => {
  it('accepts valid coordinates and drops unknown fields', () => {
    const parsed = parseLocation({ user_id: 'r1', latitude: 14.3, longitude: 121.0, ts: 5, extra: 'x', phone: '123' });
    expect(parsed).toEqual({ user_id: 'r1', latitude: 14.3, longitude: 121.0, accuracy: undefined, ts: 5 });
    expect(parsed).not.toHaveProperty('phone');
  });

  it.each([
    null,
    { user_id: 'r1', latitude: 91, longitude: 0 },
    { user_id: 'r1', latitude: 0, longitude: 'x' },
    { latitude: 0, longitude: 0 },
  ])('rejects malformed payload %j', (payload) => {
    expect(parseLocation(payload)).toBeNull();
  });
});

describe('mergeResponderLive', () => {
  const location = (ts: number) => ({ user_id: 'r1', latitude: 1, longitude: 2, ts });

  it('shows locations only for online responders and only while fresh', () => {
    const presence = { r1: [{ availability: 'busy' as const, online_at: 'a' }] };
    expect(mergeResponderLive(presence, { r1: location(1000), r2: { ...location(1000), user_id: 'r2' } }, 2000).r2).toBeUndefined();
    expect(mergeResponderLive(presence, { r1: location(1000) }, 2000).r1).toMatchObject({ availability: 'busy', location: { latitude: 1 } });
    expect(mergeResponderLive(presence, { r1: location(1000) }, 1000 + 61_000).r1.location).toBeUndefined();
  });
});

describe('createLocationPublisher', () => {
  it('throttles, validates and sends only allowlisted fields', () => {
    const channel = fakeChannel();
    let now = 10_000;
    const publish = createLocationPublisher(() => channel, 'r1', () => now, 5000);

    expect(publish(14.3, 121.0, 8)).toBe(true);
    expect(publish(14.4, 121.1)).toBe(false);
    expect(publish(120, 0)).toBe(false);
    now += 5000;
    expect(publish(14.5, 121.2)).toBe(true);

    expect(channel.send).toHaveBeenCalledTimes(2);
    expect(channel.send.mock.calls[0][0]).toEqual({
      type: 'broadcast',
      event: 'location',
      payload: { user_id: 'r1', latitude: 14.3, longitude: 121.0, accuracy: 8, ts: 10_000 },
    });
  });

  it('does nothing without a subscribed channel', () => {
    expect(createLocationPublisher(() => null, 'r1')(1, 1)).toBe(false);
  });
});
