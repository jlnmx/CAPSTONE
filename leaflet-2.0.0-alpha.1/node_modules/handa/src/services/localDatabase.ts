import { Platform } from 'react-native';
import type * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'handa.db';

let database: SQLite.SQLiteDatabase | null = null;
let sqliteModule: typeof SQLite | null = null;
let databaseUnavailable = false;

export interface LocalIncidentInput {
  type: string;
  description: string;
  severity: 'low' | 'moderity' | 'high' | 'critical';
  location: string;
  latitude?: number;
  longitude?: number;
  photoUris: string[];
}

export interface LocalEvacueeInput {
  firstName: string;
  middleName?: string;
  lastName: string;
  age: number;
  sex: string;
  contactNumber?: string;
  address?: string;
  householdSize?: number;
  barangay?: string;
}

export interface LocalIncidentRecord extends LocalIncidentInput {
  id: string;
  syncStatus: string;
  createdAt: string;
}

export interface LocalEvacueeRecord extends LocalEvacueeInput {
  id: string;
  syncStatus: string;
  createdAt: string;
}

function getDatabase() {
  if (Platform.OS === 'web' || databaseUnavailable) {
    return null;
  }

  if (!database) {
    try {
      sqliteModule ??= require('expo-sqlite') as typeof SQLite;
      database = sqliteModule.openDatabaseSync(DATABASE_NAME);
    } catch (error) {
      databaseUnavailable = true;
      console.warn('SQLite is unavailable in this runtime; local storage is disabled.', error);
      return null;
    }
  }

  return database;
}

export function initializeLocalDatabase() {
  const db = getDatabase();
  if (!db) {
    return;
  }

  db.execSync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS evacuees (
      id TEXT PRIMARY KEY NOT NULL,
      first_name TEXT NOT NULL,
      middle_name TEXT,
      last_name TEXT NOT NULL,
      age INTEGER NOT NULL,
      sex TEXT NOT NULL,
      contact_number TEXT,
      address TEXT,
      household_size INTEGER,
      barangay TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      location TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      photo_uris TEXT NOT NULL DEFAULT '[]',
      sync_status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);
  try { db.execSync('ALTER TABLE incidents ADD COLUMN latitude REAL;'); } catch { }
  try { db.execSync('ALTER TABLE incidents ADD COLUMN longitude REAL;'); } catch { }
}

export function saveLocalIncident(input: LocalIncidentInput) {
  const db = getDatabase();
  if (!db) {
    return null;
  }

  initializeLocalDatabase();
  const id = `incident-${Date.now()}`;
  const createdAt = new Date().toISOString();
  const payload = JSON.stringify({ ...input, id, createdAt });

  db.withTransactionSync(() => {
    db.runSync(
      `INSERT INTO incidents
        (id, type, description, severity, location, latitude, longitude, photo_uris, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.type,
      input.description,
      input.severity,
      input.location,
      input.latitude ?? null,
      input.longitude ?? null,
      JSON.stringify(input.photoUris),
      createdAt,
    );
    db.runSync(
      `INSERT INTO outbox
        (entity_type, entity_id, operation, payload, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      'incident',
      id,
      'create',
      payload,
      createdAt,
    );
  });

  return id;
}

export function saveLocalEvacuee(input: LocalEvacueeInput) {
  const db = getDatabase();
  if (!db) {
    return null;
  }

  initializeLocalDatabase();
  const id = `evacuee-${Date.now()}`;
  const createdAt = new Date().toISOString();
  const payload = JSON.stringify({ ...input, id, createdAt });

  db.withTransactionSync(() => {
    db.runSync(
      `INSERT INTO evacuees
        (id, first_name, middle_name, last_name, age, sex, contact_number,
         address, household_size, barangay, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.firstName,
      input.middleName ?? null,
      input.lastName,
      input.age,
      input.sex,
      input.contactNumber ?? null,
      input.address ?? null,
      input.householdSize ?? null,
      input.barangay ?? null,
      createdAt,
    );
    db.runSync(
      `INSERT INTO outbox
        (entity_type, entity_id, operation, payload, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      'evacuee',
      id,
      'create',
      payload,
      createdAt,
    );
  });

  return id;
}

export function getLocalEvacuees() {
  const db = getDatabase();
  if (!db) {
    return [];
  }

  initializeLocalDatabase();
  return db.getAllSync<LocalEvacueeRecord>(
    `SELECT
       id,
       first_name AS firstName,
       middle_name AS middleName,
       last_name AS lastName,
       age,
       sex,
       contact_number AS contactNumber,
       address,
       household_size AS householdSize,
       barangay,
       sync_status AS syncStatus,
       created_at AS createdAt
     FROM evacuees
     ORDER BY created_at DESC`,
  );
}

export function getLocalIncidents() {
  const db = getDatabase();
  if (!db) {
    return [];
  }

  initializeLocalDatabase();
  return db.getAllSync<LocalIncidentRecord>(
    `SELECT
       id,
       type,
       description,
       severity,
       location,
      latitude,
      longitude,
       photo_uris AS photoUris,
       sync_status AS syncStatus,
       created_at AS createdAt
     FROM incidents
     ORDER BY created_at DESC`,
  ).map((incident) => ({
    ...incident,
    photoUris: typeof incident.photoUris === 'string' ? JSON.parse(incident.photoUris) as string[] : incident.photoUris,
  }));
}

export function getPendingSyncCount() {
  const db = getDatabase();
  if (!db) {
    return 0;
  }

  initializeLocalDatabase();
  const result = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM outbox WHERE status = 'pending'",
  );
  return result?.count ?? 0;
}

export function getPendingOutboxEvents() {
  const db = getDatabase();
  if (!db) {
    return [];
  }

  initializeLocalDatabase();
  return db.getAllSync<{ id: number; entityType: string; entityId: string; operation: string; payload: string }>(
    `SELECT id, entity_type AS entityType, entity_id AS entityId, operation, payload
     FROM outbox
     WHERE status = 'pending'
     ORDER BY id ASC
     LIMIT 100`,
  );
}

export function markOutboxEventSynced(outboxId: number, entityType: string, entityId: string) {
  const db = getDatabase();
  if (!db) {
    return;
  }

  initializeLocalDatabase();
  db.withTransactionSync(() => {
    db.runSync("UPDATE outbox SET status = 'synced' WHERE id = ?", outboxId);
    db.runSync(`UPDATE ${entityType === 'incident' ? 'incidents' : 'evacuees'} SET sync_status = 'synced' WHERE id = ?`, entityId);
  });
}