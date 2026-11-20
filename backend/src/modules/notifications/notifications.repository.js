'use strict';

function listByUser(db, userId) {
  return db('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC, notification_id DESC LIMIT 200', [userId]);
}

function markRead(db, notificationId, userId) {
  return db('UPDATE notifications SET is_read = true WHERE notification_id = $1 AND user_id = $2', [notificationId, userId]);
}

function markAllRead(db, userId) {
  return db('UPDATE notifications SET is_read = true WHERE user_id = $1 AND NOT is_read', [userId]);
}

//автор заявки і працівники, за якими закріплено пристрій або вузол, до якого він входить
function notifyTicketUsers(db, ticketId, type, title, body, exceptUserId = null) {
  return db(
    `INSERT INTO notifications (user_id, type, task_id, title, body)
     SELECT u.user_id, $2, (SELECT t.task_id FROM tasks t WHERE t.ticket_id = tk.ticket_id LIMIT 1), $3, $4
       FROM tickets tk
       JOIN equipment e USING (equipment_id)
       JOIN users u ON u.role = 'EMPLOYEE' AND u.is_active
      WHERE tk.ticket_id = $1
        AND u.user_id IS DISTINCT FROM $5::int
        AND (u.user_id = tk.reported_by_user_id
             OR EXISTS (SELECT 1 FROM equipment o WHERE o.assigned_user_id = u.user_id AND e.tree_path LIKE o.tree_path || '%'))`,
    [ticketId, type, title, body, exceptUserId]
  );
}

//журнал подій: запис кожному адміністратору
function logEvent(db, where, param, type, title, body) {
  return db(
    `INSERT INTO notifications (user_id, type, task_id, title, body)
     SELECT a.user_id, $2, t.task_id,
            $3 || ': ' || wt.name || ' · ' || e.name || ' (' || e.inventory_number || ')',
            concat_ws(' · ', $4::text,
                      CASE WHEN tk.ticket_id IS NULL THEN 'за графіком планових робіт'
                           ELSE 'заявка №' || tk.ticket_id || ' від ' || r.full_name END)
       FROM tasks t
       JOIN equipment e USING (equipment_id)
       JOIN work_types wt ON wt.work_type = t.work_type
       LEFT JOIN tickets tk ON tk.ticket_id = t.ticket_id
       LEFT JOIN users r ON r.user_id = tk.reported_by_user_id
       JOIN users a ON a.role = 'IT_ADMIN' AND a.is_active
      WHERE ${where}`,
    [param, type, title, body]
  );
}

const logTaskEvent = (db, taskIds, type, title, body = null) => logEvent(db, 't.task_id = ANY($1::int[])', taskIds, type, title, body);
const logTicketEvent = (db, ticketId, type, title, body = null) => logEvent(db, 't.ticket_id = $1', ticketId, type, title, body);

module.exports = { listByUser, markRead, markAllRead, notifyTicketUsers, logTaskEvent, logTicketEvent };
