import { ChannelLike } from '../realtimeChannel';
import { createLocationPublisher, mergeResponderLive, parseLocation, resolveResponderLocationArea } from '../responderLive';
import { isRealtimeEnabledForUser } from '../realtimeTopics';

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

  it('accepts current city and barangay labels without other payload fields', () => {
    expect(parseLocation({
      user_id: 'r1',
      latitude: 14.3,
      longitude: 121.0,
      city: 'Biñan City',
      barangay: 'Canlalay',
      phone: '123',
    })).toMatchObject({ city: 'Biñan City', barangay: 'Canlalay' });
    expect(parseLocation({ user_id: 'r1', latitude: 14.3, longitude: 121.0, city: 3 })).not.toHaveProperty('city');
    expect(parseLocation({
      user_id: 'r1',
      latitude: 14.3,
      longitude: 121.0,
      city: 'Santa Rosa',
      barangay: 'Balibago',
    })).not.toHaveProperty('barangay');
  });
});

describe('resolveResponderLocationArea', () => {
  it('includes the barangay only when the reverse-geocoded city is Biñan', () => {
    expect(resolveResponderLocationArea({ city: 'Biñan City', district: 'Barangay Canlalay' }))
      .toEqual({ city: 'Biñan City', barangay: 'Canlalay' });
    expect(resolveResponderLocationArea({ city: 'Santa Rosa', district: 'Balibago', subregion: 'Laguna' }))
      .toEqual({ city: 'Santa Rosa' });
  });
});

describe('isRealtimeEnabledForUser', () => {
  it('allows authenticated demo responders on the live responder channel only', () => {
    const demoResponder = { role: 'responder', isDemo: true };
    expect(isRealtimeEnabledForUser(demoResponder, ['responder'])).toBe(false);
    expect(isRealtimeEnabledForUser(demoResponder, ['responder'], true)).toBe(true);
    expect(isRealtimeEnabledForUser({ role: 'resident', isDemo: true }, ['responder'], true)).toBe(false);
    expect(isRealtimeEnabledForUser({ role: 'admin', isDemo: true }, ['admin'], true)).toBe(false);
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

  it('sends locality labels with the transient GPS update', () => {
    const channel = fakeChannel();
    const publish = createLocationPublisher(() => channel, 'r1', () => 10_000);
    expect(publish(14.3, 121.0, undefined, { city: 'Biñan City', barangay: 'Canlalay' })).toBe(true);
    expect(channel.send.mock.calls[0][0].payload).toMatchObject({ city: 'Biñan City', barangay: 'Canlalay' });
  });

  it('does nothing without a subscribed channel', () => {
    expect(createLocationPublisher(() => null, 'r1')(1, 1)).toBe(false);
  });
});
