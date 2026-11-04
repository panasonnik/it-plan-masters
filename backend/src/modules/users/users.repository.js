'use strict';

const { USER_COLUMNS } = require('../auth/auth.repository');

function listAll(db) {
  return db(`SELECT ${USER_COLUMNS} FROM users ORDER BY full_name`);
}

async function insertUser(db, email, passwordHash, fullName, role) {
  const [user] = await db(
    `INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING ${USER_COLUMNS}`,
    [email, passwordHash, fullName, role]
  );
  return user;
}

async function findRole(db, userId) {
  const [user] = await db('SELECT role, is_active FROM users WHERE user_id = $1', [userId]);
  return user;
}

async function countActiveAdmins(db) {
  const [{ count }] = await db("SELECT count(*)::int AS count FROM users WHERE role = 'IT_ADMIN' AND is_active");
  return count;
}

async function updateUser(db, userId, input) {
  const [user] = await db(
    `UPDATE users
        SET full_name = COALESCE($2, full_name), role = COALESCE($3, role), is_active = COALESCE($4, is_active)
      WHERE user_id = $1
      RETURNING ${USER_COLUMNS}`,
    [userId, input.fullName ?? null, input.role ?? null, input.isActive ?? null]
  );
  return user;
}

module.exports = { listAll, insertUser, findRole, countActiveAdmins, updateUser };
