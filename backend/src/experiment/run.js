'use strict';

//доробляємо всі роботи після періоду

const { runHorizon } = require('../scheduling/simulator');
const { toTime, workingMinutesBetween } = require('../scheduling/calendar');
const { tasksFor, shiftsAfter } = require('./scenario');

const FIRST_TAIL_DAYS = 10;
const MAX_TAIL_DAYS = 640;
const CALENDAR_MARGIN_DAYS = 5;

function simulateToTheEnd(scenario, tasks, algorithm, groupByParent) {
  for (let tail = FIRST_TAIL_DAYS; tail <= MAX_TAIL_DAYS; tail *= 2) {
    const extra = shiftsAfter(scenario, tail + CALENDAR_MARGIN_DAYS);
    const result = runHorizon({
      tasks,
      days: [...scenario.periodShifts, ...extra.slice(0, tail)],
      calendarDays: [...scenario.periodShifts, ...extra],
      rule: algorithm,
      groupByParent,
    });

    if (result.unscheduled.length === 0) return result;
  }

  throw new Error(`Work is still left after ${MAX_TAIL_DAYS} extra days (${algorithm})`);
}

function measure(scenario, tasks, algorithm, groupByParent = true) {
  const result = simulateToTheEnd(scenario, tasks, algorithm, groupByParent);
  let busy = 0;
  let lastCompletion = 0;

  for (const item of result.items) {
    busy += workingMinutesBetween(item.plannedStart, item.plannedEnd, scenario.calendar);
    lastCompletion = Math.max(lastCompletion, toTime(item.plannedEnd));
  }

  const z = result.metrics.totalWeightedLoss;

  return {
    z,
    zUnplanned: result.metrics.lossUnplanned,
    zPlanned: result.metrics.lossPlanned,
    s: z / scenario.employees,
    u: busy / scenario.capacityMinutes,
    lastCompletion,
  };
}

function runSeed(scenario, levelIndex, seed, rules) {
  const level = scenario.levels[levelIndex];
  const tasks = tasksFor(scenario, level.k, seed);

  return rules.map((algorithm) => ({
    levelIndex,
    rho: level.rho,
    rhoActual: level.rhoActual,
    algorithm,
    seed,
    ...measure(scenario, tasks, algorithm),
  }));
}

module.exports = { measure, runSeed };
