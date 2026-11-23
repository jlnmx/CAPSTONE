import type { UserRole } from '../types';

export function pushNotificationRoute(type: unknown, role: UserRole) {
  if (type === 'evacuation' && role === 'resident') return '/(resident)/verify-status';
  if (type === 'weather' && role === 'resident') return '/(resident)/weather';
  if (type === 'weather' && role === 'responder') return '/(responder)/weather';
  if (type === 'incident' && role === 'resident') return '/(resident)/incidents';
  if (type === 'incident' && role === 'responder') return '/(responder)/incidents';
  if (type === 'dispatch' && role === 'responder') return '/(responder)/incidents';
  return null;
}
