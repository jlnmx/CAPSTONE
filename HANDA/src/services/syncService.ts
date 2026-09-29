import { Platform } from 'react-native';
import { authenticatedFetch } from './apiClient';
import { getPendingOutboxEvents, markOutboxEventSynced } from './localDatabase';
let activeSync: Promise<{ processed: number; synced: number }> | null = null;

export async function syncPendingLocalData() {
  if (activeSync) {
    return activeSync;
  }

  activeSync = syncPendingLocalDataInternal();
  try {
    return await activeSync;
  } finally {
    activeSync = null;
  }
}

async function syncPendingLocalDataInternal() {
  if (Platform.OS === 'web') {
    return { processed: 0, synced: 0 };
  }

  const events = getPendingOutboxEvents();
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
      return { processed: events.length, synced: 0 };
    }

    const result = await response.json() as { results?: Array<{ status?: string }> };
    let synced = 0;
    result.results?.forEach((item, index) => {
      const event = events[index];
      if (item.status === 'accepted') {
        markOutboxEventSynced(event.id, event.entityType, event.entityId);
        synced += 1;
      }
    });
    return { processed: events.length, synced };
  } catch {
    return { processed: events.length, synced: 0 };
  }
}