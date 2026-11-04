'use strict';

const bcrypt = require('bcryptjs');
const { query } = require('../../db');
const { httpError } = require('../../errors');
const { signToken } = require('../../auth');
const repo = require('./auth.repository');

//роль завжди EMPLOYEE
async function register(input) {
  const passwordHash = await bcrypt.hash(input.password, 10);

  try {
    const user = await repo.insertUser(query, input.email, passwordHash, input.fullName);
    return { token: signToken(user), user };
  } catch (err) {
    if (err.code === '23505') throw httpError(409, 'Користувач із таким email уже існує');
    throw err;
  }
}

async function login(input) {
  const user = await repo.findByEmail(query, input.email);

  if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
    throw httpError(401, 'Невірний email або пароль');
  }
  if (!user.is_active) throw httpError(403, 'Обліковий запис вимкнено — зверніться до адміністратора');

  delete user.password_hash;
  return { token: signToken(user), user };
}

async function currentUser(userId) {
  const user = await repo.findById(query, userId);
  if (!user) throw httpError(404, 'Користувача не знайдено');
  return user;
}

module.exports = { register, login, currentUser };
