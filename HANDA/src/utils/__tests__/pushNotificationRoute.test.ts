import { pushNotificationRoute } from '../pushNotificationRoute';

describe('push notification routing', () => {
  it('opens the appropriate incident list', () => {
    expect(pushNotificationRoute('incident', 'resident')).toBe('/(resident)/incidents');
    expect(pushNotificationRoute('incident', 'responder')).toBe('/(responder)/incidents');
  });

  it('opens the responder incident list for dispatch alerts only', () => {
    expect(pushNotificationRoute('dispatch', 'responder')).toBe('/(responder)/incidents');
    expect(pushNotificationRoute('dispatch', 'resident')).toBeNull();
  });

  it('opens evacuation status only for residents', () => {
    expect(pushNotificationRoute('evacuation', 'resident')).toBe('/(resident)/verify-status');
    expect(pushNotificationRoute('evacuation', 'responder')).toBeNull();
    expect(pushNotificationRoute('unknown', 'resident')).toBeNull();
  });

  it('opens the role-specific weather forecast for weather alerts', () => {
    expect(pushNotificationRoute('weather', 'resident')).toBe('/(resident)/weather');
    expect(pushNotificationRoute('weather', 'responder')).toBe('/(responder)/weather');
  });
});
