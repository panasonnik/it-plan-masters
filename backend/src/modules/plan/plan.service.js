'use strict';

const { query, transaction } = require('../../db');
const repo = require('./plan.repository');
const referencesRepo = require('../references/references.repository');
const { syncTicket } = require('../tickets/tickets.service');
const { buildSchedule } = require('../../scheduling/planner');
const { groupUnderWay } = require('../../scheduling/grouping');
const { calendarFromShifts, addWorkingMinutes } = require('../../scheduling/calendar');

//запас днів календаря
const CALENDAR_DAYS_AHEAD = 14;

function dateOf(moment) {
  const date = new Date(moment);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function loadShifts(db, fromDate, toDate) {
  const rows = await repo.findShifts(db, fromDate, toDate);
  return rows.map((row) => ({
    day: row.day,
    startAt: row.start_at,
    endAt: row.end_at,
    breakStartAt: row.break_start_at,
    breakEndAt: row.break_end_at,
  }));
}

async function loadOpenTasks(db) {
  const rows = await repo.findOpenTasks(db);
  return rows.map((row) => ({
    taskId: row.task_id,
    p: row.estimated_minutes,
    w: row.people_count,
    r: row.release_at,
    d: row.due_at,
    source: row.source,
    equipmentId: row.equipment_id,
    treePath: row.tree_path,
  }));
}

async function setStatuses(db, taskIds, from, to, comment) {
  const changed = await repo.updateStatuses(db, taskIds, from, to);
  for (const row of changed) await syncTicket(db, row.task_id, comment);
}

async function replanToday(now = new Date()) {
  return transaction(async (db) => {
    const rule = await referencesRepo.getSetting(db, 'ALGORITHM');
    const tasks = await loadOpenTasks(db);
    const last = await repo.findLastStarted(db);
    const inProgress = last && last.status === 'IN_PROGRESS' ? last : null;

    const moments = [now, ...tasks.map((task) => task.r), ...(inProgress ? [inProgress.started_at] : [])];
    const firstDay = dateOf(Math.min(...moments.map((moment) => new Date(moment).getTime())));
    const lastDay = dateOf(now.getTime() + CALENDAR_DAYS_AHEAD * 24 * 60 * 60 * 1000);
    const shifts = await loadShifts(db, firstDay, lastDay);
    const calendar = calendarFromShifts(shifts);
    const today = shifts.find((shift) => shift.day === dateOf(now));

    let items = [];
    if (today) {
      const expectedEnd = inProgress ? addWorkingMinutes(inProgress.started_at, inProgress.estimated_minutes, calendar) : 0;
      const group = last && last.group_root_equipment_id ? { equipmentId: last.group_root_equipment_id, treePath: last.root_path } : null;
      items = buildSchedule({
        tasks,
        shift: today,
        rule,
        now,
        startAt: new Date(Math.max(now.getTime(), expectedEnd)),
        activeGroup: last ? groupUnderWay({ start: last.started_at, group }, today.startAt) : null,
        calendar,
      });
    }

    await repo.deletePlanItems(db);
    for (const [index, item] of items.entries()) await repo.insertPlanItem(db, item, index + 1);

    const placed = items.map((item) => item.taskId);
    const notPlaced = tasks.map((task) => task.taskId).filter((taskId) => !placed.includes(taskId));
    await setStatuses(db, placed, 'NEW', 'SCHEDULED', 'Роботу внесено в план на сьогодні');
    await setStatuses(db, notPlaced, 'SCHEDULED', 'NEW', 'Сьогодні не вміщується — чекає наступного дня');

    return { rule, planned: items.length };
  });
}

async function todayView() {
  const current = await repo.findCurrent(query);

  return {
    rule: await referencesRepo.getSetting(query, 'ALGORITHM'),
    current,
    next: await repo.findNext(query),
    waiting: await repo.findWaiting(query),
    done: await repo.findDoneToday(query),
  };
}

async function planNow() {
  await replanToday();
  return todayView();
}

async function changeRule(rule) {
  await referencesRepo.setRule(query, rule);
  await replanToday();
  return todayView();
}

module.exports = { dateOf, loadShifts, replanToday, todayView, planNow, changeRule };
