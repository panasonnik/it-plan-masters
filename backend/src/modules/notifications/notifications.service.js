'use strict';

const { query } = require('../../db');
const repo = require('./notifications.repository');

function listMine(userId) {
  return repo.listByUser(query, userId);
}

async function markRead(notificationId, userId) {
  await repo.markRead(query, notificationId, userId);
}

async function markAllRead(userId) {
  await repo.markAllRead(query, userId);
}

module.exports = { listMine, markRead, markAllRead };
