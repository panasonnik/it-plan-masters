'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { pool, query, transaction } = require('./db');

const FOLDER = path.join(__dirname, '../db/migrations');

async function migrate() {
  if (process.argv.includes('--reset')) {
    if (!config.db.database.endsWith('_test') && process.env.ALLOW_DB_RESET !== '1') {
      throw new Error('migrate:reset видаляє всі дані; дозволено лише для тестової бази');
    }
    await query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  }

  await query('CREATE TABLE IF NOT EXISTS migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const applied = new Set((await query('SELECT filename FROM migrations')).map((row) => row.filename));
  const files = fs.readdirSync(FOLDER).filter((file) => file.endsWith('.sql') && !applied.has(file)).sort();

  //кожен файл — окрема транзакція
  for (const file of files) {
    const sql = fs.readFileSync(path.join(FOLDER, file), 'utf8');
    try {
      await transaction(async (db) => {
        await db(sql);
        await db('INSERT INTO migrations (filename) VALUES ($1)', [file]);
      });
    } catch (err) {
      throw new Error(`${file}: ${err.message}`);
    }
    console.log(`[migrate] ${file} ok`);
  }

  console.log(files.length > 0 ? `[migrate] applied ${files.length}` : '[migrate] nothing to apply');
}

migrate()
  .catch((err) => {
    console.error('[migrate] failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
