import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'handa.db';

let database: SQLite.SQLiteDatabase | null = null;

export interface LocalIncidentInput {
  type: string;
  description: string;
  severity: 'low' | 'moderity' | 'high' | 'critical';
  location: string;
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

function getDatabase() {
  if (Platform.OS === 'web') {
    return null;
  }

  if (!database) {
    database = SQLite.openDatabaseSync(DATABASE_NAME);
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
        (id, type, description, severity, location, photo_uris, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.type,
      input.description,
      input.severity,
      input.location,
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