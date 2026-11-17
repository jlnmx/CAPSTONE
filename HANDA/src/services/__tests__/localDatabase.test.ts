const mockDatabase = {
  execSync: jest.fn(),
  getAllSync: jest.fn((query: string) => query.includes('FROM outbox')
    ? [{ id: 1, entityType: 'incident', entityId: 'incident-1', operation: 'create', payload: '{}' }]
    : [{ name: 'owner_user_id' }]),
  getFirstSync: jest.fn(() => ({ count: 1 })),
  runSync: jest.fn(() => ({ changes: 1 })),
  withTransactionSync: jest.fn((callback: () => void) => callback()),
};

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-sqlite', () => ({ openDatabaseSync: () => mockDatabase }));

import {
  claimUnassignedLocalData,
  getFailedSyncCount,
  getLocalIncidents,
  getPendingOutboxEvents,
  getUnclaimedPendingOutboxCount,
  markOutboxEventSynced,
  saveLocalIncident,
} from '../localDatabase';

describe('account-scoped local database', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('only reads pending sync events owned by the active account', () => {
    getPendingOutboxEvents('resident-1');
    const [query, ownerId] = mockDatabase.getAllSync.mock.calls
      .find(([sql]) => typeof sql === 'string' && sql.includes("status = 'pending'")) ?? [];

    expect(query).toContain('owner_user_id = ?');
    expect(ownerId).toBe('resident-1');
  });

  it('counts rejected reports only for their owning account', () => {
    expect(getFailedSyncCount('resident-2')).toBe(1);
    const [query, ownerId] = mockDatabase.getFirstSync.mock.calls[0];
    expect(query).toContain("status = 'failed'");
    expect(query).toContain('owner_user_id = ?');
    expect(ownerId).toBe('resident-2');
  });

  it('filters local incident history by account and tags new reports with that account', () => {
    getLocalIncidents('resident-2');
    expect(mockDatabase.getAllSync.mock.calls.some(([query, ownerId]) =>
      typeof query === 'string' && query.includes('FROM incidents') && query.includes('owner_user_id = ?') && ownerId === 'resident-2',
    )).toBe(true);

    saveLocalIncident({
      id: 'incident-new',
      type: 'Fire',
      description: 'Smoke',
      location: 'Poblacion',
      photoUris: [],
    }, 'resident-2');

    const incidentInsert = mockDatabase.runSync.mock.calls.find(([query]) =>
      typeof query === 'string' && query.includes('INSERT INTO incidents'),
    );
    const outboxInsert = mockDatabase.runSync.mock.calls.find(([query]) =>
      typeof query === 'string' && query.includes('INSERT INTO outbox'),
    );
    expect(incidentInsert?.[incidentInsert.length - 1]).toBe('resident-2');
    expect(outboxInsert?.[outboxInsert.length - 1]).toBe('resident-2');
  });

  it('leaves legacy rows unclaimed until explicitly claimed and scopes sync acknowledgements', () => {
    expect(getUnclaimedPendingOutboxCount()).toBe(1);
    expect(claimUnassignedLocalData('resident-3')).toBe(1);
    expect(mockDatabase.runSync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE owner_user_id IS NULL'),
      'resident-3',
    );

    mockDatabase.runSync.mockClear();
    markOutboxEventSynced(3, 'incident', 'incident-1', 'resident-3');
    expect(mockDatabase.runSync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = ? AND owner_user_id = ?'),
      3,
      'resident-3',
    );
  });
});
