import type { UserRole } from '../types';

export function pushNotificationRoute(type: unknown, role: UserRole) {
  if (type === 'evacuation' && role === 'resident') return '/(resident)/verify-status';
  if (type === 'incident' && role === 'resident') return '/(resident)/incidents';
  if (type === 'incident' && role === 'responder') return '/(responder)/incidents';
  return null;
}
