'use strict';

//час у UTC

const { calendarFromShifts, workingMinutesOf } = require('../scheduling/calendar');
const { createGenerator, createStream } = require('./random');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PLANNED_ID_BASE = 1000000;

const MASTER_LIST_OFFSET = 2 ** 30;

function addDays(isoDate, days) {
  return new Date(new Date(`${isoDate}T00:00:00Z`).getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

function midnight(isoDate) {
  return new Date(`${isoDate}T00:00:00Z`);
}

function isoWeekday(isoDate) {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function shiftsFrom(firstDate, count, weekShifts) {
  const byWeekday = new Map(weekShifts.map((row) => [row.dayOfWeek, row]));
  const shifts = [];
  let date = firstDate;

  while (shifts.length < count) {
    const row = byWeekday.get(isoWeekday(date));
    const at = (time) => new Date(`${date}T${time}Z`);

    if (row) {
      shifts.push({
        date,
        startAt: at(row.startTime),
        endAt: at(row.endTime),
        breakStartAt: row.breakStart ? at(row.breakStart) : null,
        breakEndAt: row.breakEnd ? at(row.breakEnd) : null,
      });
    }

    date = addDays(date, 1);
  }

  return shifts;
}

function shiftsAfter(scenario, count) {
  return shiftsFrom(addDays(scenario.lastDate, 1), count, scenario.weekShifts);
}

//лише вікна в межах періоду
function plannedWorks(rules, firstDate, lastDate, random) {
  const planned = [];
  const phases = rules.map((rule) => Math.floor(random() * rule.periodDays));

  rules.forEach((rule, index) => {
    for (let nominal = addDays(firstDate, phases[index]); nominal <= lastDate; nominal = addDays(nominal, rule.periodDays)) {
      planned.push({
        taskId: PLANNED_ID_BASE + planned.length + 1,
        source: 'PLANNED',
        p: rule.p,
        w: rule.w,
        r: midnight(addDays(nominal, -rule.toleranceDays)),
        d: midnight(addDays(nominal, rule.toleranceDays + 1)),
        equipmentId: rule.equipmentId,
        treePath: rule.treePath,
      });
    }
  });

  const periodEnd = midnight(addDays(lastDate, 1)).getTime();
  return planned.filter((task) => task.d.getTime() <= periodEnd);
}

function weightedPick(items, random) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let threshold = random() * total;

  for (const item of items) {
    threshold -= item.weight;
    if (threshold <= 0) return item;
  }

  return items[items.length - 1];
}

function masterList(equipment, minutesNeeded, plannedMinutes, categoryWeights, random) {
  const candidates = equipment
    .filter((item) => item.symptoms.length > 0)
    .map((item) => ({ ...item, weight: categoryWeights[item.category] }));

  const list = [];
  let minutes = 0;

  while (minutes + plannedMinutes < minutesNeeded) {
    const item = weightedPick(candidates, random);
    const symptom = item.symptoms[Math.floor(random() * item.symptoms.length)];

    list.push({ equipmentId: item.equipmentId, treePath: item.treePath, p: symptom.p, w: item.w });
    minutes += symptom.p;
  }

  return list;
}

//K заявок для рівня ρ
function levelsOf(levels, master, plannedMinutes, capacityMinutes) {
  return levels.map((target, index) => {
    let k = 0;
    let ticketMinutes = 0;

    while (ticketMinutes + plannedMinutes < target * capacityMinutes) {
      ticketMinutes += master[k].p;
      k += 1;
    }

    const total = ticketMinutes + plannedMinutes;
    return { index, rho: target, k, rhoActual: total / capacityMinutes, plannedShare: plannedMinutes / total };
  });
}

function buildScenario(catalog, config) {
  const { start, workingDays } = config.period;
  const periodShifts = shiftsFrom(start, workingDays, catalog.weekShifts);
  const calendar = calendarFromShifts(periodShifts);
  const capacityMinutes = workingMinutesOf(calendar);
  const lastDate = periodShifts[periodShifts.length - 1].date;

  const planned = plannedWorks(catalog.rules, start, lastDate, createGenerator(config.scenarioSeed));
  const plannedMinutes = planned.reduce((sum, task) => sum + task.p, 0);

  const master = masterList(
    catalog.equipment,
    Math.max(...config.levels) * capacityMinutes,
    plannedMinutes,
    config.categoryWeights,
    createGenerator(config.scenarioSeed, MASTER_LIST_OFFSET)
  );

  return {
    lastDate,
    weekShifts: catalog.weekShifts,
    periodShifts,
    calendar,
    capacityMinutes,
    planned,
    plannedMinutes,
    master,
    levels: levelsOf(config.levels, master, plannedMinutes, capacityMinutes),
    employees: catalog.employees.length,
  };
}

function momentAt(calendar, minutes) {
  let rest = minutes * 60000;

  for (const interval of calendar) {
    const length = interval.end - interval.start;
    if (rest < length) return new Date(interval.start + Math.floor(rest));
    rest -= length;
  }

  return new Date(calendar[calendar.length - 1].end - 1);
}

//для заявки d = r
function tasksFor(scenario, k, seed) {
  const next = createStream(seed);

  const tickets = scenario.master.slice(0, k).map((entry, index) => {
    const r = momentAt(scenario.calendar, next() * scenario.capacityMinutes);

    return {
      taskId: index + 1,
      source: 'TICKET',
      p: entry.p,
      w: entry.w,
      r,
      d: r,
      equipmentId: entry.equipmentId,
      treePath: entry.treePath,
    };
  });

  return [...tickets, ...scenario.planned];
}

module.exports = { buildScenario, shiftsAfter, tasksFor };
