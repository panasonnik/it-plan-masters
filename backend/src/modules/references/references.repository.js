'use strict';

//медіана або початкова оцінка
const NORM_SQL = `CASE WHEN n.sample_count >= (SELECT setting_value::int FROM settings WHERE setting_key = 'NORM_MIN_SAMPLES')
                       AND n.observed_median_minutes IS NOT NULL
                      THEN n.observed_median_minutes ELSE n.seed_minutes END`;

async function normMinutes(db, equipmentId, workType) {
  const [row] = await db(
    `SELECT ${NORM_SQL} AS minutes
       FROM equipment e JOIN service_norms n USING (equipment_type_id)
      WHERE e.equipment_id = $1 AND n.work_type = $2`,
    [equipmentId, workType]
  );
  return row ? row.minutes : null;
}

function refreshNormMedian(db, equipmentId, workType) {
  return db(
    `UPDATE service_norms n
        SET observed_median_minutes = GREATEST(1, round(o.median)::int), sample_count = o.samples
       FROM (SELECT e.equipment_type_id, t.work_type,
                    percentile_cont(0.5) WITHIN GROUP (ORDER BY t.actual_minutes) AS median, count(*) AS samples
               FROM tasks t JOIN equipment e USING (equipment_id)
              WHERE t.status = 'DONE' AND t.actual_minutes > 0
                AND e.equipment_type_id = (SELECT equipment_type_id FROM equipment WHERE equipment_id = $1) AND t.work_type = $2
              GROUP BY e.equipment_type_id, t.work_type) o
      WHERE n.equipment_type_id = o.equipment_type_id AND n.work_type = o.work_type`,
    [equipmentId, workType]
  );
}

async function getSetting(db, key) {
  const [row] = await db('SELECT setting_value FROM settings WHERE setting_key = $1', [key]);
  return row ? row.setting_value : null;
}

function setRule(db, rule) {
  return db("UPDATE settings SET setting_value = $1 WHERE setting_key = 'ALGORITHM'", [rule]);
}

function symptomsFor(db, equipmentId) {
  return db(
    `SELECT s.symptom_id, s.label FROM symptoms s JOIN equipment e ON e.equipment_id = $1
      WHERE s.equipment_type_id = e.equipment_type_id OR s.equipment_type_id IS NULL
      ORDER BY s.equipment_type_id NULLS LAST, s.symptom_id`,
    [equipmentId]
  );
}

function listEquipmentTypes(db) {
  return db('SELECT equipment_type_id, code, name, category FROM equipment_types ORDER BY name');
}

function listWorkTypes(db) {
  return db('SELECT work_type, name FROM work_types ORDER BY name');
}

async function insertWorkType(db, workType, name) {
  const [row] = await db('INSERT INTO work_types (work_type, name) VALUES ($1, $2) RETURNING *', [workType, name]);
  return row;
}

function listWorkHours(db) {
  return db('SELECT * FROM work_hours ORDER BY day_of_week');
}

function deleteWorkHours(db) {
  return db('DELETE FROM work_hours');
}

function insertWorkHours(db, day) {
  return db('INSERT INTO work_hours VALUES ($1, $2, $3, $4, $5)', [day.day_of_week, day.start_time, day.end_time, day.break_start, day.break_end]);
}

function listSettings(db) {
  return db("SELECT * FROM settings WHERE setting_key <> 'ALGORITHM' ORDER BY setting_key");
}

async function updateSetting(db, key, value) {
  const [row] = await db("UPDATE settings SET setting_value = $2 WHERE setting_key = $1 AND setting_key <> 'ALGORITHM' RETURNING *", [key, value]);
  return row;
}

//назви з TABLES, не із запиту
function listRows(db, table) {
  return db(`SELECT * FROM ${table.table} ORDER BY ${table.key}`);
}

async function insertRow(db, table, input) {
  const columns = Object.keys(input);
  const [row] = await db(
    `INSERT INTO ${table.table} (${columns.join(', ')}) VALUES (${columns.map((c, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
    Object.values(input)
  );
  return row;
}

async function updateRow(db, table, rowId, input) {
  const assignments = Object.keys(input).map((column, i) => `${column} = $${i + 2}`);
  const [row] = await db(`UPDATE ${table.table} SET ${assignments.join(', ')} WHERE ${table.key} = $1 RETURNING *`, [
    rowId,
    ...Object.values(input),
  ]);
  return row;
}

function deleteRow(db, table, rowId) {
  return db(`DELETE FROM ${table.table} WHERE ${table.key} = $1`, [rowId]);
}

module.exports = {
  NORM_SQL,
  normMinutes,
  refreshNormMedian,
  getSetting,
  setRule,
  symptomsFor,
  listEquipmentTypes,
  listWorkTypes,
  insertWorkType,
  listWorkHours,
  deleteWorkHours,
  insertWorkHours,
  listSettings,
  updateSetting,
  listRows,
  insertRow,
  updateRow,
  deleteRow,
};
