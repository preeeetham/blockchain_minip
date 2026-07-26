const { Pool } = require('pg');

// ─── Supabase Postgres connection ───────────────────────────────────────────
// Set DATABASE_URL in backend/.env (never commit credentials to source control).
if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL environment variable is not set.');
  console.error('       Create backend/.env with DATABASE_URL=postgresql://...');
  process.exit(1);
}
const DATABASE_URL = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: DATABASE_URL,
  // Supabase requires SSL. The managed cert chain isn't in the local trust
  // store, so disable strict verification (standard for Supabase clients).
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error:', err.message);
});

/**
 * Create tables if they don't already exist. Idempotent — safe on every boot.
 */
async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS datasets (
      dataset_id    TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      description   TEXT DEFAULT '',
      current_hash  TEXT NOT NULL,
      version_count INTEGER DEFAULT 1,
      created_at    BIGINT NOT NULL,
      updated_at    BIGINT NOT NULL,
      ipfs_cid      TEXT DEFAULT '',
      metadata_uri  TEXT DEFAULT '',
      authority     TEXT NOT NULL,
      tx_signature  TEXT DEFAULT '',
      is_active     BOOLEAN DEFAULT TRUE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS versions (
      id                 SERIAL PRIMARY KEY,
      dataset_id         TEXT NOT NULL REFERENCES datasets(dataset_id) ON DELETE CASCADE,
      version_number     INTEGER NOT NULL,
      previous_hash      TEXT DEFAULT '',
      file_hash          TEXT NOT NULL,
      change_description TEXT DEFAULT '',
      updated_by         TEXT NOT NULL,
      tx_signature       TEXT DEFAULT '',
      timestamp          BIGINT NOT NULL,
      ipfs_cid           TEXT DEFAULT ''
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_versions_dataset
      ON versions (dataset_id, version_number);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_datasets_active
      ON datasets (is_active);
  `);
}

module.exports = { pool, initSchema, DATABASE_URL };
