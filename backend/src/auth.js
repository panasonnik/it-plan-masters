'use strict';

const jwt = require('jsonwebtoken');
const config = require('./config');
const { httpError } = require('./errors');

function signToken(user) {
  return jwt.sign({ role: user.role }, config.jwtSecret, { subject: String(user.user_id), expiresIn: '8h' });
}

function authenticate(req, res, next) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');

  try {
    if (scheme !== 'Bearer' || !token) throw new Error('no token');
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { userId: Number(payload.sub), role: payload.role };
    next();
  } catch {
    next(httpError(401, 'Увійдіть у систему ще раз'));
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'IT_ADMIN') return next(httpError(403, 'Ця дія доступна лише адміністратору'));
  next();
}

module.exports = { signToken, authenticate, requireAdmin };
