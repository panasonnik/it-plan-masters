'use strict';

const { Pool, types } = require('pg');
const config = require('./config');

//дата без зсуву на день
types.setTypeParser(types.builtins.DATE, (value) => value);

const pool = new Pool(config.db);

async function query(text, params) {
  const result = await pool.query(text, params);
  return result.rows;
}

async function transaction(callback) {
  const client = await pool.connect();
  const run = async (text, params) => (await client.query(text, params)).rows;

  try {
    await client.query('BEGIN');
    const result = await callback(run);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, transaction };
