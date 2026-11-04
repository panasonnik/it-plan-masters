'use strict';

const { query, transaction } = require('../../db');
const { httpError } = require('../../errors');
const repo = require('./tickets.repository');
const equipmentRepo = require('../equipment/equipment.repository');
const referencesRepo = require('../references/references.repository');
const notificationsRepo = require('../notifications/notifications.repository');

const STATUS_WORDS = { NEW: 'прийнято', SCHEDULED: 'заплановано', IN_PROGRESS: 'у роботі', DONE: 'виконано', REJECTED: 'відхилено' };
const TASK_TO_TICKET = { NEW: 'NEW', SCHEDULED: 'SCHEDULED', IN_PROGRESS: 'IN_PROGRESS', DONE: 'DONE', CANCELLED: 'REJECTED' };

async function setTicketStatus(db, ticketId, status, comment) {
  const ticket = await repo.updateStatus(db, ticketId, status);
  if (!ticket) return;

  await repo.insertHistory(db, ticketId, status, comment);
  await notificationsRepo.insertNotification(db, ticket.reported_by_user_id, 'TICKET', `Заявка №${ticketId}: ${STATUS_WORDS[status]}`, comment);
}

//статус заявки за статусом роботи
async function syncTicket(db, taskId, comment) {
  const task = await repo.findTaskTicket(db, taskId);
  if (task && task.ticket_id) await setTicketStatus(db, task.ticket_id, TASK_TO_TICKET[task.status], comment);
}

async function createTicket(user, input) {
  const symptom = await repo.findSymptom(query, input.symptomId);
  if (!symptom) throw httpError(422, 'Симптом не знайдено');

  if (user.role !== 'IT_ADMIN' && !(await equipmentRepo.canSee(query, user.userId, input.equipmentId))) {
    throw httpError(403, 'Це обладнання не закріплене за вами');
  }

  try {
    return await transaction(async (db) => {
      const minutes = await referencesRepo.normMinutes(db, input.equipmentId, symptom.work_type);
      if (minutes === null) throw httpError(422, 'Для цього пристрою немає нормативу тривалості — зверніться до адміністратора');

      const ticketId = await repo.insertTicket(db, user.userId, input);
      await repo.insertHistory(db, ticketId, 'NEW', 'Заявку створено');
      const people = await equipmentRepo.peopleCount(db, input.equipmentId);
      await repo.insertTask(db, ticketId, input.equipmentId, symptom.work_type, minutes, people);
      return ticketId;
    });
  } catch (err) {
    //дубль ловить унікальний індекс
    if (err.constraint === 'uq_tasks_open_ticket') throw httpError(409, 'Про цю несправність уже повідомлено — заявка в роботі');
    throw err;
  }
}

function listMine(userId) {
  return repo.listByUser(query, userId);
}

function listAll() {
  return repo.listAll(query);
}

async function rejectTicket(ticketId, reason) {
  await transaction(async (db) => {
    const ticket = await repo.findStatus(db, ticketId);
    if (!ticket) throw httpError(404, 'Заявку не знайдено');
    if (!['NEW', 'SCHEDULED'].includes(ticket.status)) throw httpError(409, 'Роботу вже розпочато — заявку не можна відхилити');

    await repo.setRejectReason(db, ticketId, reason);
    await repo.cancelTask(db, ticketId);
    await repo.deletePlanItems(db, ticketId);
    await setTicketStatus(db, ticketId, 'REJECTED', reason);
  });
}

module.exports = { createTicket, listMine, listAll, rejectTicket, syncTicket };
