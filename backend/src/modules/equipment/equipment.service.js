'use strict';

const { query, transaction } = require('../../db');
const { httpError } = require('../../errors');
const repo = require('./equipment.repository');

function listMine(userId) {
  return repo.listByUser(query, userId);
}

function listAll() {
  return repo.listAll(query);
}

async function pathFor(db, equipmentId, parentId) {
  if (parentId === null) return `.${equipmentId}.`;

  const parentPath = await repo.findPath(db, parentId);
  if (!parentPath) throw httpError(422, 'Батьківське обладнання не знайдено');
  //перевірка циклу
  if (parentPath.includes(`.${equipmentId}.`)) throw httpError(422, 'Не можна перемістити вузол у його власне піддерево');

  return `${parentPath}${equipmentId}.`;
}

//підрозділ зберігає лише корінь; дочірнє показується під батьком
function withDepartment(input) {
  return { ...input, departmentId: input.parentEquipmentId === null ? input.departmentId : null };
}

function createEquipment(input) {
  return transaction(async (db) => {
    const equipmentId = await repo.insertEquipment(db, withDepartment(input));
    await repo.setPath(db, equipmentId, await pathFor(db, equipmentId, input.parentEquipmentId));
    return equipmentId;
  });
}

//назва та інвентарний номер незмінні після створення
function changesIdentity(current, input) {
  return (
    (input.name !== undefined && input.name !== current.name) ||
    (input.inventoryNumber !== undefined && input.inventoryNumber !== current.inventory_number)
  );
}

async function updateEquipment(equipmentId, input) {
  await transaction(async (db) => {
    const current = await repo.findIdentity(db, equipmentId);
    if (!current) throw httpError(404, 'Обладнання не знайдено');
    if (changesIdentity(current, input)) {
      throw httpError(422, 'Назву та інвентарний номер обладнання не можна змінити після створення');
    }

    await repo.updateEquipment(db, equipmentId, withDepartment(input));

    const path = await pathFor(db, equipmentId, input.parentEquipmentId);
    if (path !== current.tree_path) await repo.movePaths(db, current.tree_path, path);
  });
}

async function deleteEquipment(equipmentId) {
  if (await repo.hasChildren(query, equipmentId)) throw httpError(409, 'Спочатку видаліть або перемістіть дочірнє обладнання');
  await repo.deleteEquipment(query, equipmentId);
}

async function addConsumer(equipmentId, userId) {
  await repo.addConsumer(query, equipmentId, userId);
}

async function removeConsumer(equipmentId, userId) {
  await repo.removeConsumer(query, equipmentId, userId);
}

module.exports = { listMine, listAll, createEquipment, updateEquipment, deleteEquipment, addConsumer, removeConsumer };
