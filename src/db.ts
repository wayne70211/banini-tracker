import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';

const DATA_DIR = process.env.DATA_DIR || join(homedir(), '.banini-tracker');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = join(DATA_DIR, 'banini.db');
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  migrate(db);

  return db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id TEXT NOT NULL,
      post_url TEXT,
      symbol_name TEXT NOT NULL,
      symbol_code TEXT,
      symbol_type TEXT NOT NULL,
      her_action TEXT NOT NULL,
      reverse_view TEXT NOT NULL,
      confidence TEXT NOT NULL,
      reasoning TEXT,
      base_price REAL,
      created_at TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'tracking',
      realized_at TEXT,
      days_to_realize INTEGER,
      peak_change_pct REAL,
      UNIQUE(post_id, symbol_name)
    );

    CREATE TABLE IF NOT EXISTS price_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prediction_id INTEGER NOT NULL REFERENCES predictions(id),
      date TEXT NOT NULL,
      open_price REAL NOT NULL,
      high_price REAL NOT NULL,
      low_price REAL NOT NULL,
      close_price REAL NOT NULL,
      change_pct_close REAL NOT NULL,
      change_pct_extreme REAL NOT NULL,
      UNIQUE(prediction_id, date)
    );
  `);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
