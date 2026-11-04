'use strict';

const COLUMNS = `
  tk.ticket_id, tk.status, tk.description, tk.reject_reason, tk.created_at, tk.reported_by_user_id,
  e.name AS equipment_name, e.inventory_number, s.label AS symptom_label, u.full_name AS reported_by_name,
  t.task_id, t.work_type, wt.name AS work_type_name, t.estimated_minutes, t.people_count,
  (SELECT json_agg(h ORDER BY h.changed_at, h.ticket_history_id) FROM ticket_history h WHERE h.ticket_id = tk.ticket_id) AS history`;

const FROM = `
  FROM tickets tk
  JOIN equipment e USING (equipment_id)
  JOIN symptoms s USING (symptom_id)
  JOIN users u ON u.user_id = tk.reported_by_user_id
  LEFT JOIN tasks t ON t.ticket_id = tk.ticket_id
  LEFT JOIN work_types wt ON wt.work_type = t.work_type`;

function listByUser(db, userId) {
  return db(`SELECT ${COLUMNS} ${FROM} WHERE tk.reported_by_user_id = $1 ORDER BY tk.ticket_id DESC`, [userId]);
}

function listAll(db) {
  return db(`SELECT ${COLUMNS} ${FROM} ORDER BY tk.ticket_id DESC`);
}

async function findSymptom(db, symptomId) {
  const [symptom] = await db('SELECT work_type FROM symptoms WHERE symptom_id = $1', [symptomId]);
  return symptom;
}

async function findStatus(db, ticketId) {
  const [ticket] = await db('SELECT status FROM tickets WHERE ticket_id = $1', [ticketId]);
  return ticket;
}

async function insertTicket(db, userId, input) {
  const [ticket] = await db(
    'INSERT INTO tickets (reported_by_user_id, equipment_id, symptom_id, description) VALUES ($1, $2, $3, $4) RETURNING ticket_id',
    [userId, input.equipmentId, input.symptomId, input.description || null]
  );
  return ticket.ticket_id;
}

function insertTask(db, ticketId, equipmentId, workType, minutes, people) {
  return db(
    `INSERT INTO tasks (source, ticket_id, equipment_id, work_type, estimated_minutes, people_count, release_at)
     VALUES ('TICKET', $1, $2, $3, $4, $5, now())`,
    [ticketId, equipmentId, workType, minutes, people]
  );
}

async function updateStatus(db, ticketId, status) {
  const [ticket] = await db('UPDATE tickets SET status = $2 WHERE ticket_id = $1 AND status <> $2 RETURNING reported_by_user_id', [
    ticketId,
    status,
  ]);
  return ticket;
}

function insertHistory(db, ticketId, status, comment) {
  return db('INSERT INTO ticket_history (ticket_id, status, comment) VALUES ($1, $2, $3)', [ticketId, status, comment]);
}

async function findTaskTicket(db, taskId) {
  const [task] = await db('SELECT ticket_id, status FROM tasks WHERE task_id = $1', [taskId]);
  return task;
}

function setRejectReason(db, ticketId, reason) {
  return db('UPDATE tickets SET reject_reason = $2 WHERE ticket_id = $1', [ticketId, reason]);
}

function cancelTask(db, ticketId) {
  return db("UPDATE tasks SET status = 'CANCELLED' WHERE ticket_id = $1", [ticketId]);
}

function deletePlanItems(db, ticketId) {
  return db('DELETE FROM plan_items WHERE task_id IN (SELECT task_id FROM tasks WHERE ticket_id = $1)', [ticketId]);
}

module.exports = {
  listByUser,
  listAll,
  findSymptom,
  findStatus,
  insertTicket,
  insertTask,
  updateStatus,
  insertHistory,
  findTaskTicket,
  setRejectReason,
  cancelTask,
  deletePlanItems,
};
