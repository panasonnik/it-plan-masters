'use strict';

//порядок шляхів як чисел
const TREE_ORDER = "ORDER BY string_to_array(trim(both '.' from e.tree_path), '.')::int[]";

//формула (4.5)
const PROPOSED_PEOPLE = `(
  SELECT GREATEST(1, count(DISTINCT x.user_id))::int FROM (
    SELECT s.assigned_user_id AS user_id FROM equipment s
     WHERE s.tree_path LIKE e.tree_path || '%' AND s.assigned_user_id IS NOT NULL
    UNION
    SELECT c.user_id FROM equipment_consumers c JOIN equipment s USING (equipment_id)
     WHERE s.tree_path LIKE e.tree_path || '%'
  ) x
)`;

const PEOPLE_SQL = `COALESCE(e.affected_people, ${PROPOSED_PEOPLE})`;

const COLUMNS = `
  e.equipment_id, e.inventory_number, e.name, e.equipment_type_id, e.parent_equipment_id,
  e.assigned_user_id, e.tree_path, e.affected_people,
  t.name AS type_name, u.full_name AS assigned_user_name,
  ${PROPOSED_PEOPLE} AS proposed_people`;

const FROM = `
  FROM equipment e
  JOIN equipment_types t USING (equipment_type_id)
  LEFT JOIN users u ON u.user_id = e.assigned_user_id`;

function listByUser(db, userId) {
  return db(
    `SELECT ${COLUMNS} ${FROM}
      WHERE EXISTS (SELECT 1 FROM equipment o WHERE o.assigned_user_id = $1 AND e.tree_path LIKE o.tree_path || '%')
      ${TREE_ORDER}`,
    [userId]
  );
}

function listAll(db) {
  return db(
    `SELECT ${COLUMNS},
            ARRAY(SELECT c.user_id FROM equipment_consumers c WHERE c.equipment_id = e.equipment_id ORDER BY c.user_id) AS consumer_ids
     ${FROM} ${TREE_ORDER}`
  );
}

async function canSee(db, userId, equipmentId) {
  const rows = await db(
    `SELECT 1 FROM equipment target
       JOIN equipment owned ON target.tree_path LIKE owned.tree_path || '%'
      WHERE target.equipment_id = $1 AND owned.assigned_user_id = $2`,
    [equipmentId, userId]
  );
  return rows.length > 0;
}

async function peopleCount(db, equipmentId) {
  const [row] = await db(`SELECT ${PEOPLE_SQL} AS n FROM equipment e WHERE e.equipment_id = $1`, [equipmentId]);
  return row.n;
}

async function findPath(db, equipmentId) {
  const [row] = await db('SELECT tree_path FROM equipment WHERE equipment_id = $1', [equipmentId]);
  return row ? row.tree_path : null;
}

async function insertEquipment(db, input) {
  const [row] = await db(
    `INSERT INTO equipment (inventory_number, name, equipment_type_id, parent_equipment_id, assigned_user_id, affected_people)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING equipment_id`,
    [input.inventoryNumber, input.name, input.equipmentTypeId, input.parentEquipmentId, input.assignedUserId, input.affectedPeople]
  );
  return row.equipment_id;
}

function setPath(db, equipmentId, path) {
  return db('UPDATE equipment SET tree_path = $2 WHERE equipment_id = $1', [equipmentId, path]);
}

function updateEquipment(db, equipmentId, input) {
  return db(
    `UPDATE equipment
        SET inventory_number = $2, name = $3, equipment_type_id = $4, parent_equipment_id = $5,
            assigned_user_id = $6, affected_people = $7
      WHERE equipment_id = $1`,
    [equipmentId, input.inventoryNumber, input.name, input.equipmentTypeId, input.parentEquipmentId, input.assignedUserId, input.affectedPeople]
  );
}

function movePaths(db, oldPath, newPath) {
  return db(
    `UPDATE equipment SET tree_path = $2 || substring(tree_path FROM length($1) + 1)
      WHERE tree_path LIKE $1 || '%'`,
    [oldPath, newPath]
  );
}

async function hasChildren(db, equipmentId) {
  const rows = await db('SELECT 1 FROM equipment WHERE parent_equipment_id = $1', [equipmentId]);
  return rows.length > 0;
}

function deleteEquipment(db, equipmentId) {
  return db('DELETE FROM equipment WHERE equipment_id = $1', [equipmentId]);
}

function addConsumer(db, equipmentId, userId) {
  return db('INSERT INTO equipment_consumers (equipment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [equipmentId, userId]);
}

function removeConsumer(db, equipmentId, userId) {
  return db('DELETE FROM equipment_consumers WHERE equipment_id = $1 AND user_id = $2', [equipmentId, userId]);
}

module.exports = {
  PEOPLE_SQL,
  listByUser,
  listAll,
  canSee,
  peopleCount,
  findPath,
  insertEquipment,
  setPath,
  updateEquipment,
  movePaths,
  hasChildren,
  deleteEquipment,
  addConsumer,
  removeConsumer,
};
