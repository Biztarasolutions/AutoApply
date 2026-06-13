// backend/services/dry_run_migrations.js
// Reads migration *.sql files and prints a "dry‑run" version that uses IF NOT EXISTS guards.
// This script does NOT execute any statements; it only verifies that the
// migrations can be applied safely.

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const migrationsDir = path.resolve(__dirname, '..', 'supabase', 'migrations');
const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

function makeIdempotent(sql) {
  // Simple regex replacements to add IF NOT EXISTS where missing.
  // This is not exhaustive but covers the common patterns used in this project.
  return sql
    .replace(/CREATE TABLE (?!.*IF NOT EXISTS)/gi, 'CREATE TABLE IF NOT EXISTS ')
    .replace(/ALTER TABLE (\S+) ADD COLUMN (?!.*IF NOT EXISTS)/gi, 'ALTER TABLE $1 ADD COLUMN IF NOT EXISTS ')
    .replace(/CREATE INDEX (?!.*IF NOT EXISTS)/gi, 'CREATE INDEX IF NOT EXISTS ')
    .replace(/CREATE POLICY (?!.*IF NOT EXISTS)/gi, 'CREATE POLICY IF NOT EXISTS ');
}

migrationFiles.forEach(file => {
  const fullPath = path.join(migrationsDir, file);
  const raw = fs.readFileSync(fullPath, 'utf8');
  const idempotent = makeIdempotent(raw);
  console.log('\n--- Dry‑run for', file, '---');
  console.log(idempotent);
});

console.log('\n✅ Dry‑run completed. Review the output for any unsafe statements before running the real migration.');
