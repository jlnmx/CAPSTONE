import { Platform } from 'react-native';
import { authenticatedFetch } from './apiClient';
import { getPendingOutboxEvents, markOutboxEventFailed, markOutboxEventSynced } from './localDatabase';
const activeSyncs = new Map<string, Promise<{ processed: number; synced: number }>>();
const syncListeners = new Set<() => void>();

export function onSyncCompleted(listener: () => void) {
  syncListeners.add(listener);
  return () => { syncListeners.delete(listener); };
}

function notifySyncListeners() {
  syncListeners.forEach((listener) => listener());
}

export async function syncPendingLocalData(ownerUserId: string) {
  if (!ownerUserId) return { processed: 0, synced: 0 };
  const activeSync = activeSyncs.get(ownerUserId);
  if (activeSync) {
    return activeSync;
  }

  const pendingSync = syncPendingLocalDataInternal(ownerUserId);
  activeSyncs.set(ownerUserId, pendingSync);
  try {
    return await pendingSync;
  } finally {
    if (activeSyncs.get(ownerUserId) === pendingSync) activeSyncs.delete(ownerUserId);
  }
}

async function syncPendingLocalDataInternal(ownerUserId: string) {
  if (Platform.OS === 'web') {
    return { processed: 0, synced: 0 };
  }

  const events = getPendingOutboxEvents(ownerUserId);
  if (events.length === 0) {
    return { processed: 0, synced: 0 };
  }

  try {
    const response = await authenticatedFetch('/api/v1/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: events.map((event) => ({
          entityType: event.entityType,
          operation: event.operation,
          payload: JSON.parse(event.payload),
        })),
      }),
    });
    if (!response.ok) {
      console.warn(`Offline sync was rejected with HTTP ${response.status}; queued reports remain saved.`);
      return { processed: events.length, synced: 0 };
    }

    const result = await response.json() as { results?: Array<{ status?: string; error?: string; permanent?: boolean }> };
    let synced = 0;
    result.results?.forEach((item, index) => {
      const event = events[index];
      if (item.status === 'accepted') {
        markOutboxEventSynced(event.id, event.entityType, event.entityId, ownerUserId);
        synced += 1;
      } else if (item.status === 'rejected' && item.permanent) {
        markOutboxEventFailed(event.id, item.error ?? 'The server rejected this item.', ownerUserId);
      }
    });
    if (synced > 0 || result.results?.some((item) => item.status === 'rejected')) notifySyncListeners();
    return { processed: events.length, synced };
  } catch (error) {
    console.warn('Offline sync could not reach the HANDA API; queued reports remain saved.', error);
    return { processed: events.length, synced: 0 };
  }
}