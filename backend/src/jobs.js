'use strict';

const cron = require('node-cron');
const { query } = require('./db');
const { replanToday, dateOf } = require('./modules/plan/plan.service');
const { PEOPLE_SQL } = require('./modules/equipment/equipment.repository');
const { NORM_SQL } = require('./modules/references/references.repository');

const RECIPIENTS = `
  SELECT e.assigned_user_id AS user_id FROM equipment e WHERE e.equipment_id = t.equipment_id AND e.assigned_user_id IS NOT NULL
  UNION
  SELECT c.user_id FROM equipment_consumers c WHERE c.equipment_id = t.equipment_id`;

//вікно θ − δ … θ + δ
async function createPlannedTasks() {
  const created = await query(
    `INSERT INTO tasks (source, maintenance_rule_id, equipment_id, work_type, estimated_minutes, people_count, release_at, due_at)
     SELECT 'PLANNED', r.maintenance_rule_id, r.equipment_id, r.work_type,
            ${NORM_SQL}, ${PEOPLE_SQL},
            (r.next_due_date - r.tolerance_days)::timestamptz,
            (r.next_due_date + r.tolerance_days + 1)::timestamptz
       FROM maintenance_rules r
       JOIN equipment e USING (equipment_id)
       JOIN service_norms n ON n.equipment_type_id = e.equipment_type_id AND n.work_type = r.work_type
      WHERE r.next_due_date <= current_date + (SELECT setting_value::int FROM settings WHERE setting_key = 'PLAN_HORIZON_DAYS')
        AND NOT EXISTS (SELECT 1 FROM tasks o WHERE o.maintenance_rule_id = r.maintenance_rule_id AND o.status IN ('NEW', 'SCHEDULED', 'IN_PROGRESS'))
     ON CONFLICT DO NOTHING
     RETURNING task_id`
  );

  await query(
    `INSERT INTO notifications (user_id, type, task_id, title, body)
     SELECT p.user_id, 'MAINTENANCE_PLANNED', t.task_id, 'Заплановано обслуговування: ' || e.name,
            'Роботи виконають між ' || to_char(t.release_at, 'DD.MM') || ' і ' || to_char(t.due_at - interval '1 day', 'DD.MM') || '.'
       FROM tasks t JOIN equipment e USING (equipment_id), LATERAL (${RECIPIENTS}) p
      WHERE t.task_id = ANY($1)`,
    [created.map((row) => row.task_id)]
  );

  return `planned tasks created: ${created.length}`;
}

async function remindMaintenance() {
  const rows = await query(
    `INSERT INTO notifications (user_id, type, task_id, title, body)
     SELECT p.user_id, 'MAINTENANCE_SOON', t.task_id, 'Найближчим часом обслуговування: ' || e.name,
            'Заплановано на ' || to_char(COALESCE(pi.planned_start_at, t.release_at), 'DD.MM') || '.'
       FROM tasks t
       JOIN equipment e USING (equipment_id)
       LEFT JOIN plan_items pi ON pi.task_id = t.task_id,
       LATERAL (${RECIPIENTS}) p
      WHERE t.source = 'PLANNED' AND t.status IN ('NEW', 'SCHEDULED')
        AND COALESCE(pi.planned_start_at, t.release_at)
            <= now() + make_interval(days => (SELECT setting_value::int FROM settings WHERE setting_key = 'REMINDER_DAYS'))
        AND NOT EXISTS (SELECT 1 FROM notifications n
                         WHERE n.type = 'MAINTENANCE_SOON' AND n.task_id = t.task_id AND n.user_id = p.user_id)
     RETURNING notification_id`
  );
  return `reminders sent: ${rows.length}`;
}

async function planAtShiftStart() {
  const now = new Date();
  const rows = await query(
    "SELECT 1 FROM work_hours WHERE day_of_week = EXTRACT(isodow FROM now()) AND to_char(start_time, 'HH24:MI') = to_char(now(), 'HH24:MI')"
  );
  if (rows.length === 0) return null;

  const result = await replanToday(now);
  return `${dateOf(now)}: ${result.planned} tasks planned by ${result.rule}`;
}

const JOBS = {
  planned: { schedule: '0 1 * * *', run: createPlannedTasks },
  reminders: { schedule: '0 8 * * *', run: remindMaintenance },
  plan: { schedule: '* * * * *', run: planAtShiftStart },
};

//збій задачі не зупиняє сервер
async function runJob(name) {
  try {
    const message = await JOBS[name].run();
    if (message) console.log(`[job ${name}] ${message}`);
  } catch (err) {
    console.error(`[job ${name}] failed:`, err);
  }
}

function start() {
  for (const name of Object.keys(JOBS)) cron.schedule(JOBS[name].schedule, () => runJob(name));
}

module.exports = { start, runJob };

if (require.main === module) {
  const name = process.argv[2];
  if (!JOBS[name]) {
    console.error(`Usage: node src/jobs.js ${Object.keys(JOBS).join(' | ')}`);
    process.exit(1);
  }
  runJob(name).then(() => require('./db').pool.end());
}
