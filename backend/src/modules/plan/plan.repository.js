'use strict';

const TASK_COLUMNS = `
  t.task_id, t.source, t.status, t.work_type, wt.name AS work_type_name, t.estimated_minutes, t.people_count,
  t.release_at, t.due_at, t.started_at, t.finished_at, t.actual_minutes, t.ticket_id,
  e.equipment_id, e.name AS equipment_name, e.inventory_number,
  s.label AS symptom_label, tk.description, u.full_name AS reported_by_name,
  ARRAY(SELECT json_build_object('work_type', n.work_type, 'name', w.name)
          FROM service_norms n JOIN work_types w USING (work_type)
         WHERE n.equipment_type_id = e.equipment_type_id ORDER BY w.name) AS work_types`;

const TASK_FROM = `
  FROM tasks t
  JOIN work_types wt USING (work_type)
  JOIN equipment e USING (equipment_id)
  LEFT JOIN tickets tk ON tk.ticket_id = t.ticket_id
  LEFT JOIN symptoms s ON s.symptom_id = tk.symptom_id
  LEFT JOIN users u ON u.user_id = tk.reported_by_user_id`;

function findShifts(db, fromDate, toDate) {
  return db(
    `SELECT to_char(d, 'YYYY-MM-DD') AS day,
            (d::date + w.start_time)::timestamptz AS start_at, (d::date + w.end_time)::timestamptz AS end_at,
            (d::date + w.break_start)::timestamptz AS break_start_at, (d::date + w.break_end)::timestamptz AS break_end_at
       FROM generate_series($1::date, $2::date, interval '1 day') d
       JOIN work_hours w ON w.day_of_week = EXTRACT(isodow FROM d)
      ORDER BY d`,
    [fromDate, toDate]
  );
}

function findOpenTasks(db) {
  return db(
    `SELECT t.task_id, t.estimated_minutes, t.people_count, t.release_at, t.due_at, t.source, t.equipment_id, e.tree_path
       FROM tasks t JOIN equipment e USING (equipment_id)
      WHERE t.status IN ('NEW', 'SCHEDULED')`
  );
}

async function findLastStarted(db) {
  const [row] = await db(
    `SELECT t.status, t.started_at, t.estimated_minutes, p.group_root_equipment_id, root.tree_path AS root_path
       FROM tasks t
       LEFT JOIN plan_items p USING (task_id)
       LEFT JOIN equipment root ON root.equipment_id = p.group_root_equipment_id
      WHERE t.started_at IS NOT NULL
      ORDER BY t.started_at DESC LIMIT 1`
  );
  return row || null;
}

function updateStatuses(db, taskIds, from, to) {
  return db('UPDATE tasks SET status = $3 WHERE task_id = ANY($1) AND status = $2 RETURNING task_id', [taskIds, from, to]);
}

//лишається лише поточна робота
function deletePlanItems(db) {
  return db("DELETE FROM plan_items WHERE task_id NOT IN (SELECT task_id FROM tasks WHERE status = 'IN_PROGRESS')");
}

function insertPlanItem(db, item, position) {
  return db('INSERT INTO plan_items VALUES ($1, $2, $3, $4, $5)', [
    item.taskId,
    position,
    item.plannedStart,
    item.plannedEnd,
    item.groupRootEquipmentId,
  ]);
}

async function findCurrent(db) {
  const [current] = await db(`SELECT ${TASK_COLUMNS} ${TASK_FROM} WHERE t.status = 'IN_PROGRESS'`);
  return current || null;
}

function findNext(db) {
  return db(
    `SELECT ${TASK_COLUMNS}, p.position, p.planned_start_at, p.planned_end_at,
            p.group_root_equipment_id, root.name AS group_root_name
     ${TASK_FROM}
     JOIN plan_items p ON p.task_id = t.task_id
     LEFT JOIN equipment root ON root.equipment_id = p.group_root_equipment_id
    WHERE t.status = 'SCHEDULED'
    ORDER BY p.position`
  );
}

function findWaiting(db) {
  return db(`SELECT ${TASK_COLUMNS} ${TASK_FROM} WHERE t.status = 'NEW' AND t.release_at <= now() ORDER BY t.release_at`);
}

function findDoneToday(db) {
  return db(`SELECT ${TASK_COLUMNS} ${TASK_FROM} WHERE t.status = 'DONE' AND t.finished_at >= current_date ORDER BY t.finished_at`);
}

module.exports = {
  findShifts,
  findOpenTasks,
  findLastStarted,
  updateStatuses,
  deletePlanItems,
  insertPlanItem,
  findCurrent,
  findNext,
  findWaiting,
  findDoneToday,
};
