'use strict';

const { assignMaintenanceGroups, isInSubtree, groupUnderWay } = require('./grouping');
const { toTime, calendarFromShifts, nextWorkingMoment, addWorkingMinutes } = require('./calendar');
const { orderTasks } = require('./rules');

function groupOf(task, ready, dayEnd) {
  const rootId = assignMaintenanceGroups(ready, { dayEnd }).get(task.taskId) ?? null;
  if (rootId === null) return null;

  const root = ready.find((candidate) => candidate.source === 'PLANNED' && candidate.equipmentId === rootId);
  return { equipmentId: rootId, treePath: root.treePath };
}

//робота, очікування або кінець дня
function nextStep({ pool, cursor, shiftEnd, rule, groupByParent, activeGroup, calendar }) {
  const end = toTime(shiftEnd);
  const t = nextWorkingMoment(cursor, calendar);

  if (t >= end) return { dayOver: true };

  const ready = pool.filter((task) => toTime(task.r) <= t);

  if (ready.length === 0) {
    const arrivals = pool.map((task) => toTime(task.r)).filter((time) => time > t && time < end);
    return arrivals.length === 0 ? { dayOver: true } : { waitUntil: Math.min(...arrivals) };
  }

  const underWay = groupByParent ? activeGroup : null;
  const isMember = (task) => underWay !== null && isInSubtree(task.treePath, underWay.treePath);
  const members = ready.filter(isMember);
  const task = orderTasks(rule, members.length > 0 ? members : ready, { now: new Date(t), calendar })[0];

  return {
    task,
    start: t,
    end: addWorkingMinutes(t, task.p, calendar),
    group: isMember(task) ? underWay : groupOf(task, ready, shiftEnd),
  };
}

function buildSchedule({ tasks, shift, rule, now, startAt = null, activeGroup = null, calendar = null }) {
  const workingCalendar = calendar === null ? calendarFromShifts([shift]) : calendar;
  const shiftStart = toTime(shift.startAt);

  //лише роботи, що вже надійшли
  const knownUntil = Math.max(toTime(now), shiftStart);
  let pool = tasks.filter((task) => toTime(task.r) < toTime(shift.endAt) && toTime(task.r) <= knownUntil);
  let cursor = startAt === null ? shiftStart : Math.max(shiftStart, toTime(startAt));
  let underWay = activeGroup;
  const items = [];

  while (pool.length > 0) {
    const step = nextStep({
      pool,
      cursor,
      shiftEnd: shift.endAt,
      rule,
      groupByParent: true,
      activeGroup: underWay,
      calendar: workingCalendar,
    });

    if (step.dayOver) break;

    if (step.waitUntil !== undefined) {
      cursor = step.waitUntil;
      continue;
    }

    items.push({
      taskId: step.task.taskId,
      plannedStart: new Date(step.start),
      plannedEnd: new Date(step.end),
      groupRootEquipmentId: step.group ? step.group.equipmentId : null,
    });

    pool = pool.filter((task) => task.taskId !== step.task.taskId);
    cursor = step.end;
    underWay = groupUnderWay(step, shiftStart);
  }

  return items;
}

module.exports = { nextStep, buildSchedule };
