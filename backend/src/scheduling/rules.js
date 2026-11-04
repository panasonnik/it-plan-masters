'use strict';

const { toTime, workingMinutesBetween, nextWorkingMoment } = require('./calendar');

//момент потреби a
function needAt(task) {
  return task.source === 'PLANNED' ? task.d : task.r;
}

function hasCalendar(calendar) {
  return Array.isArray(calendar) && calendar.length > 0;
}

function workingMoment(value, calendar) {
  return hasCalendar(calendar) ? nextWorkingMoment(value, calendar) : toTime(value);
}

function minutesBetween(a, b, calendar) {
  return hasCalendar(calendar) ? workingMinutesBetween(a, b, calendar) : (toTime(b) - toTime(a)) / 60000;
}

//нічия: a, потім r, потім номер
function tieBreak(a, b, calendar) {
  return (
    workingMoment(needAt(a), calendar) - workingMoment(needAt(b), calendar) ||
    workingMoment(a.r, calendar) - workingMoment(b.r, calendar) ||
    a.taskId - b.taskId
  );
}

function descending(valueA, valueB) {
  return valueA === valueB ? 0 : valueB - valueA;
}

function ratio(numerator, p) {
  return p > 0 ? numerator / p : Infinity;
}

//правило сміта: n / p
function smithScore(task, now, calendar) {
  const isNeeded = workingMoment(now, calendar) >= workingMoment(needAt(task), calendar);
  return isNeeded ? ratio(task.w, task.p) : 0;
}

//динамічний пріоритет: n · (W + p) / p
function dynamicScore(task, now, calendar) {
  const neededFor = minutesBetween(needAt(task), now, calendar);
  return neededFor < 0 ? 0 : ratio(task.w * (neededFor + task.p), task.p);
}

const RULES = {
  FIFO: (a, b, now, calendar) => workingMoment(a.r, calendar) - workingMoment(b.r, calendar),
  EDD: (a, b, now, calendar) => workingMoment(needAt(a), calendar) - workingMoment(needAt(b), calendar),
  WSPT: (a, b, now, calendar) => descending(smithScore(a, now, calendar), smithScore(b, now, calendar)),
  DYNAMIC_RATIO: (a, b, now, calendar) => descending(dynamicScore(a, now, calendar), dynamicScore(b, now, calendar)),
};

const RULE_CODES = Object.keys(RULES);

function orderTasks(rule, tasks, { now, calendar } = {}) {
  const compare = RULES[rule];
  if (!compare) throw new Error(`Unknown rule ${rule}`);

  return [...tasks].sort((a, b) => compare(a, b, now, calendar) || tieBreak(a, b, calendar));
}

module.exports = { RULE_CODES, needAt, orderTasks };
