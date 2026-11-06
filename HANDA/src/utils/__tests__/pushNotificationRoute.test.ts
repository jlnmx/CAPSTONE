import { pushNotificationRoute } from '../pushNotificationRoute';

describe('push notification routing', () => {
  it('opens the appropriate incident list', () => {
    expect(pushNotificationRoute('incident', 'resident')).toBe('/(resident)/incidents');
    expect(pushNotificationRoute('incident', 'responder')).toBe('/(responder)/incidents');
  });

  it('opens evacuation status only for residents', () => {
    expect(pushNotificationRoute('evacuation', 'resident')).toBe('/(resident)/verify-status');
    expect(pushNotificationRoute('evacuation', 'responder')).toBeNull();
    expect(pushNotificationRoute('unknown', 'resident')).toBeNull();
  });
});
