'use strict';

function listByUser(db, userId) {
  return db('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [userId]);
}

function markRead(db, notificationId, userId) {
  return db('UPDATE notifications SET is_read = true WHERE notification_id = $1 AND user_id = $2', [notificationId, userId]);
}

function insertNotification(db, userId, type, title, body) {
  return db('INSERT INTO notifications (user_id, type, title, body) VALUES ($1, $2, $3, $4)', [userId, type, title, body]);
}

module.exports = { listByUser, markRead, insertNotification };
