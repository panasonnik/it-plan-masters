'use strict';

const { transaction } = require('../../db');
const { httpError } = require('../../errors');
const repo = require('./tasks.repository');
const referencesRepo = require('../references/references.repository');
const { syncTicket } = require('../tickets/tickets.service');
const { replanToday, todayView } = require('../plan/plan.service');

async function lockTask(db, taskId) {
  const task = await repo.lockTask(db, taskId);
  if (!task) throw httpError(404, 'Роботу не знайдено');
  return task;
}

//тривалість з нормативу
async function correctTask(taskId, input) {
  await transaction(async (db) => {
    const task = await lockTask(db, taskId);
    if (!['NEW', 'SCHEDULED'].includes(task.status)) throw httpError(409, 'Виправити роботу можна лише до її початку');

    const minutes = await referencesRepo.normMinutes(db, task.equipment_id, input.workType);
    if (minutes === null) throw httpError(422, 'Для цього виду робіт немає нормативу тривалості');

    await repo.updateCorrection(db, task.task_id, input.workType, minutes, input.peopleCount);
  });

  await replanToday();
  return todayView();
}

async function startTask(taskId) {
  await transaction(async (db) => {
    const task = await lockTask(db, taskId);
    if (!['NEW', 'SCHEDULED'].includes(task.status)) throw httpError(409, 'Цю роботу вже розпочато або завершено');
    if (await repo.hasInProgress(db)) throw httpError(409, 'Спершу завершіть роботу, яку виконуєте зараз');

    await repo.markStarted(db, task.task_id);
    await syncTicket(db, task.task_id, 'Адміністратор розпочав роботу');
  });

  await replanToday();
  return todayView();
}

async function completeTask(taskId, actualMinutes) {
  await transaction(async (db) => {
    const task = await lockTask(db, taskId);
    if (task.status === 'DONE') throw httpError(409, 'Цю роботу вже завершено');
    if (task.status !== 'IN_PROGRESS') throw httpError(409, 'Роботу ще не розпочато');

    await repo.markDone(db, task.task_id, actualMinutes);
    await referencesRepo.refreshNormMedian(db, task.equipment_id, task.work_type);
    if (task.maintenance_rule_id) await repo.moveRuleDate(db, task.maintenance_rule_id);
    await syncTicket(db, task.task_id, `Виконано за ${actualMinutes} хв`);
  });

  await replanToday();
  return todayView();
}

module.exports = { correctTask, startTask, completeTask };
