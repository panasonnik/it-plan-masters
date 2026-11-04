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

function createEquipment(input) {
  return transaction(async (db) => {
    const equipmentId = await repo.insertEquipment(db, input);
    await repo.setPath(db, equipmentId, await pathFor(db, equipmentId, input.parentEquipmentId));
    return equipmentId;
  });
}

async function updateEquipment(equipmentId, input) {
  await transaction(async (db) => {
    const oldPath = await repo.findPath(db, equipmentId);
    if (!oldPath) throw httpError(404, 'Обладнання не знайдено');

    await repo.updateEquipment(db, equipmentId, input);

    const path = await pathFor(db, equipmentId, input.parentEquipmentId);
    if (path !== oldPath) await repo.movePaths(db, oldPath, path);
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
