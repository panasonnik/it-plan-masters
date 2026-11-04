'use strict';

require('dotenv').config({ quiet: true });

function required(name) {
  if (!process.env[name]) {
    console.error(`[config] variable ${name} is missing in backend/.env (see .env.example)`);
    process.exit(1);
  }
  return process.env[name];
}

module.exports = {
  port: Number(process.env.PORT || 5000),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: required('DATABASE'),
    user: required('DB_USER'),
    password: process.env.DB_PASSWORD || '',
  },
  jwtSecret: required('JWT_SECRET'),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jobsEnabled: process.env.JOBS_ENABLED !== 'false',
};
