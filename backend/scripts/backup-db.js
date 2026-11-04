'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const config = require('../src/config');

const FOLDER = path.join(__dirname, '../backups');

const now = new Date();
const pad = (value) => String(value).padStart(2, '0');
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
const file = path.join(FOLDER, `backup-${stamp}.sql`);
const { host, port, database, user, password } = config.db;

fs.mkdirSync(FOLDER, { recursive: true });

try {
  execFileSync('pg_dump', ['-h', host, '-p', String(port), '-U', user, '-f', file, database], {
    env: { ...process.env, PGPASSWORD: password },
    stdio: 'inherit',
  });
  console.log(`[backup] ${database} -> ${file}`);
} catch (err) {
  console.error('[backup] failed:', err.message);
  process.exitCode = 1;
}
