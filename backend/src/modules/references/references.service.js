'use strict';

const { query, transaction } = require('../../db');
const { httpError } = require('../../errors');
const repo = require('./references.repository');

const TABLES = {
  symptoms: {
    table: 'symptoms',
    key: 'symptom_id',
    fields: { label: 'text', equipment_type_id: 'optionalId', work_type: 'workType' },
  },
  norms: {
    table: 'service_norms',
    key: 'service_norm_id',
    fields: { equipment_type_id: 'id', work_type: 'workType', seed_minutes: 'minutes' },
  },
  rules: {
    table: 'maintenance_rules',
    key: 'maintenance_rule_id',
    fields: { equipment_id: 'id', work_type: 'workType', period_days: 'minutes', tolerance_days: 'days', next_due_date: 'date' },
  },
};

function tableOf(name) {
  const table = TABLES[name];
  if (!table) throw httpError(404, 'Такого довідника немає');
  return table;
}

function symptomsFor(equipmentId) {
  return repo.symptomsFor(query, equipmentId);
}

function listEquipmentTypes() {
  return repo.listEquipmentTypes(query);
}

function listWorkTypes() {
  return repo.listWorkTypes(query);
}

function createWorkType(input) {
  return repo.insertWorkType(query, input.work_type, input.name);
}

function listWorkHours() {
  return repo.listWorkHours(query);
}

//день без рядка — вихідний
async function saveWorkHours(days) {
  await transaction(async (db) => {
    await repo.deleteWorkHours(db);
    for (const day of days) await repo.insertWorkHours(db, day);
  });
  return repo.listWorkHours(query);
}

function listSettings() {
  return repo.listSettings(query);
}

async function updateSetting(key, value) {
  const row = await repo.updateSetting(query, key, value);
  if (!row) throw httpError(404, 'Такого налаштування немає');
  return row;
}

function listRows(table) {
  return repo.listRows(query, table);
}

function createRow(table, input) {
  return repo.insertRow(query, table, input);
}

async function updateRow(table, rowId, input) {
  const row = await repo.updateRow(query, table, rowId, input);
  if (!row) throw httpError(404, 'Запис не знайдено');
  return row;
}

async function deleteRow(table, rowId) {
  await repo.deleteRow(query, table, rowId);
}

module.exports = {
  tableOf,
  symptomsFor,
  listEquipmentTypes,
  listWorkTypes,
  createWorkType,
  listWorkHours,
  saveWorkHours,
  listSettings,
  updateSetting,
  listRows,
  createRow,
  updateRow,
  deleteRow,
};
