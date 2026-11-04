# Фрагменти програмного коду

Скопійовано з файлів репозиторію без змін.

## Чотири правила черговості

Файл `backend/src/scheduling/rules.js`.

```js
const { toTime, workingMinutesBetween, nextWorkingMoment } = require('./calendar');

//заявка коштує з моменту r, планова робота — після кінця вікна d
function needAt(task) {
  return task.source === 'PLANNED' ? task.d : task.r;
}

function hasCalendar(calendar) {
  return Array.isArray(calendar) && calendar.length > 0;
}

//заявки о 19:30 і о 08:50 наступного ранку — обидві 09:00
function workingMoment(value, calendar) {
  return hasCalendar(calendar) ? nextWorkingMoment(value, calendar) : toTime(value);
}

function minutesBetween(a, b, calendar) {
  return hasCalendar(calendar) ? workingMinutesBetween(a, b, calendar) : (toTime(b) - toTime(a)) / 60000;
}

//нічия: момент потреби, потім r, потім номер
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

//робота нульової тривалості йде першою
function ratio(numerator, p) {
  return p > 0 ? numerator / p : Infinity;
}

//правило сміта: n / p; планова робота у своєму вікні має 0
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
```

## Вибір наступної роботи з урахуванням групи

Файл `backend/src/scheduling/planner.js`.

```js
//повертає { task, start, end, group }, { waitUntil } або { dayOver: true }
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
```

## Кінець роботи на шкалі робочого часу

Файл `backend/src/scheduling/calendar.js`.

```js
//обід і ніч лише ставлять роботу на паузу: 40 хв від 12:40 закінчаться о 14:20
function addWorkingMinutes(from, minutes, calendar) {
  const start = toTime(from);
  let rest = minutes * MS_PER_MINUTE;

  for (const interval of calendar) {
    if (interval.end <= start) continue;

    const begin = Math.max(interval.start, start);
    const length = interval.end - begin;

    if (rest <= length) return begin + rest;
    rest -= length;
  }

  throw new Error(`The working calendar ends before ${minutes} working minutes from ${new Date(start).toISOString()}`);
}
```

## Цикл симулятора

Файл `backend/src/scheduling/simulator.js`.

```js
//groupByParent = false — без групування (для тесту правила сміта)
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
```

## Моменти надходження заявок одного прогону

Файл `backend/src/experiment/scenario.js`.

```js
//ночі, обіди й вихідні не мають довжини
function momentAt(calendar, minutes) {
  let rest = minutes * 60000;

  for (const interval of calendar) {
    const length = interval.end - interval.start;
    if (rest < length) return new Date(interval.start + Math.floor(rest));
    rest -= length;
  }

  return new Date(calendar[calendar.length - 1].end - 1);
}

//заявка потрібна з моменту r, тож d = r
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
```

## Кількість прогонів N та інтервал

Файл `backend/src/experiment/statistics.js`.

```js
//формули (4.16)–(4.19)

const Z_OF_CONFIDENCE = { 0.95: 1.96, 0.997: 3 };

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;

  const average = mean(values);
  const squares = values.reduce((sum, value) => sum + (value - average) ** 2, 0);
  return Math.sqrt(squares / (values.length - 1));
}

//мале віднімання не дає 64.00000000001 стати 65
function runsByFormula(s, epsilon, z) {
  if (!(epsilon > 0) || s === 0) return 0;
  return Math.max(0, Math.ceil((z * s / epsilon) ** 2 - 1e-9));
}

function requiredRuns(s, epsilon, z, pilot) {
  return Math.max(pilot, runsByFormula(s, epsilon, z));
}

function halfWidth(s, n, z) {
  return n > 0 ? (z * s) / Math.sqrt(n) : 0;
}
```

## Живий план на сьогодні

Файл `backend/src/modules/plan/plan.service.js`.

```js
//план від поточного моменту або від очікуваного кінця роботи, яку виконують зараз
async function replanToday(now = new Date()) {
  return transaction(async (db) => {
    const rule = await referencesRepo.getSetting(db, 'ALGORITHM');
    const tasks = await loadOpenTasks(db);
    const last = await repo.findLastStarted(db);
    const inProgress = last && last.status === 'IN_PROGRESS' ? last : null;

    //календар сягає назад до найстарішої роботи
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
```
