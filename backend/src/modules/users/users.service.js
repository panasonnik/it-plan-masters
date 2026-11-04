'use strict';

const bcrypt = require('bcryptjs');
const { query } = require('../../db');
const { httpError } = require('../../errors');
const repo = require('./users.repository');

function listUsers() {
  return repo.listAll(query);
}

async function createUser(input) {
  const passwordHash = await bcrypt.hash(input.password, 10);

  try {
    return await repo.insertUser(query, input.email, passwordHash, input.fullName, input.role);
  } catch (err) {
    if (err.code === '23505') throw httpError(409, 'Користувач із таким email уже існує');
    throw err;
  }
}

async function updateUser(currentUserId, userId, input) {
  const user = await repo.findRole(query, userId);

  if (!user) throw httpError(404, 'Користувача не знайдено');
  if (input.isActive === false && userId === currentUserId) throw httpError(409, 'Не можна вимкнути власний обліковий запис');

  const losesAdmin = user.role === 'IT_ADMIN' && (input.isActive === false || input.role === 'EMPLOYEE');
  if (losesAdmin && (await repo.countActiveAdmins(query)) <= 1) {
    throw httpError(409, 'Це останній адміністратор — спершу призначте іншого');
  }

  return repo.updateUser(query, userId, input);
}

module.exports = { listUsers, createUser, updateUser };
