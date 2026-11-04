'use strict';

const { calendarFromShifts, workingMinutesBetween, addWorkingMinutes, nextWorkingMoment } = require('./calendar');
const { orderTasks, RULE_CODES } = require('./rules');
const { assignMaintenanceGroups } = require('./grouping');
const { buildSchedule } = require('./planner');
const { computeMetrics } = require('./metrics');

//пн і вт, 09:00–18:00, обід 13:00–14:00
const at = (time, day = '07') => new Date(`2026-09-${day}T${time}:00Z`);
const shift = (day) => ({ startAt: at('09:00', day), endAt: at('18:00', day), breakStartAt: at('13:00', day), breakEndAt: at('14:00', day) });
const MONDAY = shift('07');
const CALENDAR = calendarFromShifts([MONDAY, shift('08')]);

const ticket = (fields) => ({ source: 'TICKET', p: 30, w: 1, r: at('09:00'), equipmentId: fields.taskId, treePath: `.${fields.taskId}.`, ...fields, d: fields.r || at('09:00') });
const planned = (fields) => ({ source: 'PLANNED', p: 30, w: 1, r: at('00:00'), d: at('00:00', '10'), ...fields });
const ids = (list) => list.map((item) => item.taskId);

describe('календар: обід і кінець зміни', () => {
  test('зміна з обідом — два інтервали', () => {
    expect(calendarFromShifts([MONDAY])).toEqual([
      { start: at('09:00').getTime(), end: at('13:00').getTime() },
      { start: at('14:00').getTime(), end: at('18:00').getTime() },
    ]);
  });

  test('обід і ніч не рахуються як робочий час', () => {
    expect(workingMinutesBetween(at('12:00'), at('15:00'), CALENDAR)).toBe(120);
    expect(workingMinutesBetween(at('17:00'), at('10:00', '08'), CALENDAR)).toBe(120);
    expect(workingMinutesBetween(at('15:00'), at('12:00'), CALENDAR)).toBe(-120);
  });

  test('обід ставить роботу на паузу: 40 хв від 12:40 закінчаться о 14:20', () => {
    expect(addWorkingMinutes(at('12:40'), 40, CALENDAR)).toBe(at('14:20').getTime());
  });

  test('кінець зміни ставить роботу на паузу до ранку: 60 хв від 17:40 — це 09:40 наступного дня', () => {
    expect(addWorkingMinutes(at('17:40'), 60, CALENDAR)).toBe(at('09:40', '08').getTime());
  });

  test('під час обіду роботу не починають: перший робочий момент — 14:00', () => {
    expect(nextWorkingMoment(at('13:20'), CALENDAR)).toBe(at('14:00').getTime());
  });
});

describe('правила черговості', () => {
  //сервер: 6 людей, 120 хв; монітор: 1 людина, 15 хв
  const SERVER = ticket({ taskId: 100, p: 120, w: 6, r: at('09:00') });
  const MONITOR = ticket({ taskId: 200, p: 15, w: 1, r: at('09:05') });
  const order = (rule, tasks) => ids(orderTasks(rule, tasks, { now: at('10:05'), calendar: CALENDAR }));

  test('FIFO і EDD беруть сервер — він надійшов раніше', () => {
    expect(order('FIFO', [MONITOR, SERVER])).toEqual([100, 200]);
    expect(order('EDD', [MONITOR, SERVER])).toEqual([100, 200]);
  });

  test('Сміт бере монітор: 1/15 більше за 6/120', () => {
    expect(order('WSPT', [SERVER, MONITOR])).toEqual([200, 100]);
  });

  test('динамічний пріоритет бере сервер: 6·(65+120)/120 = 9,25 більше за 1·(60+15)/15 = 5', () => {
    expect(order('DYNAMIC_RATIO', [MONITOR, SERVER])).toEqual([100, 200]);
  });

  test('FIFO і EDD розходяться на плановій роботі: EDD бере її лише в кінці вікна', () => {
    const queue = [ticket({ taskId: 1, r: at('09:30') }), planned({ taskId: 2, r: at('00:00') })];
    expect(order('FIFO', queue)).toEqual([2, 1]);
    expect(order('EDD', queue)).toEqual([1, 2]);
  });

  test('планова робота всередині вікна в Сміта й динамічного пріоритету йде після заявок', () => {
    const queue = [planned({ taskId: 1, w: 100, p: 10 }), ticket({ taskId: 2, w: 1, p: 240 })];
    expect(order('WSPT', queue)).toEqual([2, 1]);
    expect(order('DYNAMIC_RATIO', queue)).toEqual([2, 1]);
  });

  test('результат не залежить від порядку на вході і вхідний масив не змінюється', () => {
    const queue = [1, 2, 3, 4, 5, 6].map((id) => ticket({ taskId: id, w: (id % 3) + 1, p: 10 * id, r: at(`09:0${id}`) }));
    const copy = JSON.stringify(queue);

    for (const rule of RULE_CODES) {
      expect(order(rule, queue)).toEqual(order(rule, [...queue].reverse()));
    }
    expect(JSON.stringify(queue)).toBe(copy);
  });
});

describe('групи робіт за ієрархією', () => {
  const PC_SERVICE = planned({ taskId: 1, equipmentId: 3, treePath: '.3.' });
  const MOUSE = ticket({ taskId: 2, equipmentId: 14, treePath: '.3.14.' });
  const OTHER = ticket({ taskId: 3, equipmentId: 70, treePath: '.30.70.' });

  test('ТО комп’ютера забирає в групу заявку на його мишку, але не на чужий .30.', () => {
    const groups = assignMaintenanceGroups([PC_SERVICE, MOUSE, OTHER], { dayEnd: at('18:00') });
    expect(groups.get(2)).toBe(3);
    expect(groups.get(3)).toBeNull();
  });

  test('ТО на двох рівнях одного дерева — одна група з коренем у найвищому', () => {
    const disk = planned({ taskId: 4, equipmentId: 9, treePath: '.1.9.' });
    const server = planned({ taskId: 5, equipmentId: 1, treePath: '.1.' });
    const groups = assignMaintenanceGroups([disk, server], { dayEnd: at('18:00') });
    expect(groups.get(4)).toBe(1);
  });

  test('ТО, вікно якого відкривається після кінця зміни, групи не утворює', () => {
    const later = planned({ taskId: 1, equipmentId: 3, treePath: '.3.', r: at('00:00', '09') });
    expect(assignMaintenanceGroups([later, MOUSE], { dayEnd: at('18:00') }).get(2)).toBeNull();
  });

  test('у плані роботи групи стоять поспіль, хоч правило поставило б чужу заявку між ними', () => {
    //мишка з розпочатої групи раніше чужої заявки
    const other = { ...OTHER, r: at('09:10'), d: at('09:10') };
    const mouse = { ...MOUSE, r: at('09:20'), d: at('09:20') };
    const items = buildSchedule({
      tasks: [other, mouse, PC_SERVICE],
      shift: MONDAY,
      rule: 'FIFO',
      now: at('10:00'),
      calendar: CALENDAR,
    });
    expect(ids(items)).toEqual([1, 2, 3]);
    expect(items[1].groupRootEquipmentId).toBe(3);
  });
});

describe('планувальник дня', () => {
  test('роботи йдуть одна за одною, обід і кінець зміни — пауза, після кінця зміни нічого не починається', () => {
    const tasks = [200, 240, 150, 30].map((p, index) => ticket({ taskId: index + 1, p }));
    const items = buildSchedule({ tasks, shift: MONDAY, rule: 'FIFO', now: at('09:00'), calendar: CALENDAR });

    expect(items.map((item) => item.plannedEnd)).toEqual([at('12:20'), at('17:20'), at('10:50', '08')]);
  });

  test('заявка, що ще не надійшла, у план не потрапляє', () => {
    const items = buildSchedule({
      tasks: [ticket({ taskId: 1 }), ticket({ taskId: 2, r: at('11:00') })],
      shift: MONDAY,
      rule: 'FIFO',
      now: at('10:00'),
      calendar: CALENDAR,
    });
    expect(ids(items)).toEqual([1]);
  });
});

describe('критерій Z', () => {
  test('заявка коштує n · WM(r, C), обід не рахується', () => {
    const metrics = computeMetrics([{ ...ticket({ taskId: 1, w: 3, r: at('12:00') }), completedAt: at('14:30') }], CALENDAR);
    expect(metrics.totalWeightedLoss).toBe(3 * 90);
  });

  test('планова робота в межах вікна нічого не коштує, після вікна — n · WM(d, C)', () => {
    const inWindow = { ...planned({ taskId: 1, w: 6, d: at('12:00') }), completedAt: at('11:00') };
    const late = { ...planned({ taskId: 2, w: 6, d: at('10:00') }), completedAt: at('10:30') };
    const metrics = computeMetrics([inWindow, late], CALENDAR);

    expect(metrics.lossPlanned).toBe(180);
    expect(metrics.lossUnplanned).toBe(0);
  });

  test('Z = Z_позапл + Z_план', () => {
    const items = [
      { ...ticket({ taskId: 1, w: 2, r: at('09:00') }), completedAt: at('09:40') },
      { ...planned({ taskId: 2, w: 1, d: at('09:00') }), completedAt: at('10:00') },
    ];
    const metrics = computeMetrics(items, CALENDAR);

    expect(metrics).toEqual({ totalWeightedLoss: 140, lossUnplanned: 80, lossPlanned: 60 });
  });
});
