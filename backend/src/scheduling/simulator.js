'use strict';

const { nextStep } = require('./planner');
const { groupUnderWay } = require('./grouping');
const { computeMetrics } = require('./metrics');
const { toTime, calendarFromShifts } = require('./calendar');

//groupByParent = false — без групування
function runHorizon({ tasks, days, rule, groupByParent = true, calendarDays = null }) {
  const calendar = calendarFromShifts(calendarDays === null ? days : calendarDays);
  const byId = new Map(tasks.map((task) => [task.taskId, task]));
  let pending = [...tasks];
  let lastStep = null;
  let carryOver = null;
  const items = [];

  for (const shift of days) {
    const shiftStart = toTime(shift.startAt);
    let t = Math.max(shiftStart, carryOver ?? 0);

    for (;;) {
      const step = nextStep({
        pool: pending,
        cursor: t,
        shiftEnd: shift.endAt,
        rule,
        groupByParent,
        activeGroup: groupUnderWay(lastStep, shiftStart),
        calendar,
      });

      if (step.dayOver) break;

      if (step.waitUntil !== undefined) {
        t = step.waitUntil;
        continue;
      }

      items.push({ taskId: step.task.taskId, plannedStart: new Date(step.start), plannedEnd: new Date(step.end) });
      t = step.end;
      lastStep = step;
      pending = pending.filter((task) => task.taskId !== step.task.taskId);
    }

    carryOver = t;
  }

  const metrics = computeMetrics(
    items.map((item) => ({ ...byId.get(item.taskId), completedAt: item.plannedEnd })),
    calendar
  );

  return { items, metrics, unscheduled: pending.map((task) => task.taskId) };
}

module.exports = { runHorizon };
