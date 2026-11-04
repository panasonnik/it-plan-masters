'use strict';

async function lockTask(db, taskId) {
  const [task] = await db('SELECT * FROM tasks WHERE task_id = $1 FOR UPDATE', [taskId]);
  return task;
}

function updateCorrection(db, taskId, workType, minutes, peopleCount) {
  return db('UPDATE tasks SET work_type = $2, estimated_minutes = $3, people_count = $4 WHERE task_id = $1', [
    taskId,
    workType,
    minutes,
    peopleCount,
  ]);
}

async function hasInProgress(db) {
  const rows = await db("SELECT 1 FROM tasks WHERE status = 'IN_PROGRESS'");
  return rows.length > 0;
}

function markStarted(db, taskId) {
  return db("UPDATE tasks SET status = 'IN_PROGRESS', started_at = now() WHERE task_id = $1", [taskId]);
}

function markDone(db, taskId, actualMinutes) {
  return db("UPDATE tasks SET status = 'DONE', finished_at = now(), actual_minutes = $2 WHERE task_id = $1", [taskId, actualMinutes]);
}

//від дня виконання
function moveRuleDate(db, ruleId) {
  return db('UPDATE maintenance_rules SET next_due_date = current_date + period_days WHERE maintenance_rule_id = $1', [ruleId]);
}

module.exports = { lockTask, updateCorrection, hasInProgress, markStarted, markDone, moveRuleDate };
