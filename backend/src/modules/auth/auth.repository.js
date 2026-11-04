'use strict';

const USER_COLUMNS = 'user_id, email, full_name, role, is_active';

async function insertUser(db, email, passwordHash, fullName) {
  const [user] = await db(
    `INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING ${USER_COLUMNS}`,
    [email, passwordHash, fullName]
  );
  return user;
}

async function findByEmail(db, email) {
  const [user] = await db(`SELECT ${USER_COLUMNS}, password_hash FROM users WHERE lower(email) = $1`, [email]);
  return user;
}

async function findById(db, userId) {
  const [user] = await db(`SELECT ${USER_COLUMNS} FROM users WHERE user_id = $1`, [userId]);
  return user;
}

module.exports = { USER_COLUMNS, insertUser, findByEmail, findById };
