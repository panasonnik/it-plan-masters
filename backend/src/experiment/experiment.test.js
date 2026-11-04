'use strict';

const { runHorizon } = require('../scheduling/simulator');

const { buildScenario, tasksFor } = require('./scenario');
const { measure, runSeed } = require('./run');
const { createStream } = require('./random');
const { mean, standardDeviation, requiredRuns, halfWidth } = require('./statistics');

const RULES = ['FIFO', 'EDD', 'WSPT', 'DYNAMIC_RATIO'];

const CATALOG = {
  weekShifts: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
    dayOfWeek,
    startTime: '09:00:00',
    endTime: '18:00:00',
    breakStart: '13:00:00',
    breakEnd: '14:00:00',
  })),
  employees: [{}, {}, {}, {}],
  equipment: [
    { equipmentId: 1, treePath: '.1.', category: 'COMPUTE', w: 1, symptoms: [{ p: 20 }, { p: 40 }] },
    { equipmentId: 2, treePath: '.1.2.', category: 'PERIPHERAL', w: 1, symptoms: [{ p: 15 }] },
    { equipmentId: 4, treePath: '.4.', category: 'COMPUTE', w: 4, symptoms: [{ p: 30 }, { p: 120 }] },
    { equipmentId: 5, treePath: '.5.', category: 'PRINT', w: 2, symptoms: [{ p: 25 }] },
  ],
  rules: [
    { equipmentId: 1, treePath: '.1.', periodDays: 30, toleranceDays: 3, p: 60, w: 1 },
    { equipmentId: 5, treePath: '.5.', periodDays: 14, toleranceDays: 2, p: 30, w: 2 },
  ],
};

function scenarioOf(levels, workingDays = 20) {
  return buildScenario(CATALOG, {
    period: { start: '2026-09-07', workingDays },
    scenarioSeed: 20260906,
    categoryWeights: { COMPUTE: 3, PERIPHERAL: 6, PRINT: 2 },
    levels,
  });
}

const at = (time) => new Date(`2026-09-07T${time}:00Z`);
const ticket = (fields) => ({ source: 'TICKET', d: fields.r, ...fields });

describe('ручний приклад: чотири заявки в понеділок до обіду', () => {
  //FIFO і EDD: Z = 1·60 + 4·90 + 1·110 + 3·110 = 860
  //сміт і динамічний: Z = 4·30 + 3·30 + 1·60 + 1·120 = 390
  const tasks = [
    ticket({ taskId: 1, p: 60, w: 1, r: at('09:00'), equipmentId: 11, treePath: '.11.' }),
    ticket({ taskId: 2, p: 30, w: 4, r: at('09:00'), equipmentId: 12, treePath: '.12.' }),
    ticket({ taskId: 3, p: 20, w: 1, r: at('09:00'), equipmentId: 13, treePath: '.13.' }),
    ticket({ taskId: 4, p: 10, w: 3, r: at('09:10'), equipmentId: 14, treePath: '.14.' }),
  ];
  const expected = { FIFO: 860, EDD: 860, WSPT: 390, DYNAMIC_RATIO: 390 };
  const week = scenarioOf([0.1], 5);

  test.each(RULES)('%s', (algorithm) => {
    const result = measure(week, tasks, algorithm);

    expect(result.z).toBe(expected[algorithm]);
    expect(result.zPlanned).toBe(0);
    expect(result.s).toBe(expected[algorithm] / 4);
    expect(result.u * week.capacityMinutes).toBeCloseTo(120, 10);
    expect(new Date(result.lastCompletion).toISOString()).toBe('2026-09-07T11:00:00.000Z');
  });
});

describe('в одному прогоні U і кінець останньої роботи однакові для всіх правил', () => {
  test.each([0.3, 0.9])('ρ = %s', (rho) => {
    const records = runSeed(scenarioOf([rho]), 0, 1, RULES);

    expect(new Set(records.map((r) => r.u)).size).toBe(1);
    expect(new Set(records.map((r) => r.lastCompletion)).size).toBe(1);
  });
});

describe('правило Сміта не гірше за інші, коли всі заявки відомі з самого початку', () => {
  function staticSet(seed) {
    const next = createStream(seed);

    return Array.from({ length: 15 }, (unused, index) =>
      ticket({
        taskId: index + 1,
        p: 5 + Math.floor(next() * 116),
        w: 1 + Math.floor(next() * 8),
        r: at('09:00'),
        equipmentId: 100 + index,
        treePath: `.${100 + index}.`,
      })
    );
  }

  const week = scenarioOf([0.1], 5);
  const zOf = (tasks, algorithm) =>
    runHorizon({ tasks, days: week.periodShifts, rule: algorithm, groupByParent: false }).metrics
      .totalWeightedLoss;

  test('на 20 згенерованих наборах', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const tasks = staticSet(seed);

      for (const other of ['FIFO', 'EDD', 'DYNAMIC_RATIO']) {
        expect(zOf(tasks, 'WSPT')).toBeLessThanOrEqual(zOf(tasks, other) + 1e-9);
      }
    }
  });
});

describe('статистика на числах, порахованих вручну', () => {
  const values = [2, 4, 4, 4, 5, 5, 7, 9];

  test('середнє і відхилення', () => {
    expect(mean(values)).toBe(5);
    expect(standardDeviation(values)).toBeCloseTo(Math.sqrt(32 / 7), 12);
  });

  test('N = max(n₀, ⌈(z·s/ε)²⌉) і півширина інтервалу', () => {
    //(1,96 · 10 / 2)² = 96,04 → 97
    expect(requiredRuns(10, 2, 1.96, 50)).toBe(97);
    expect(requiredRuns(10, 20, 1.96, 50)).toBe(50);
    expect(halfWidth(10, 100, 1.96)).toBeCloseTo(1.96, 12);
  });
});

describe('відтворюваність за номером прогону', () => {
  const scenario = scenarioOf([0.5]);
  const k = scenario.levels[0].k;

  test('той самий номер дає ті самі моменти і той самий Z', () => {
    expect(tasksFor(scenario, k, 7)).toEqual(tasksFor(scenario, k, 7));
    expect(runSeed(scenario, 0, 7, RULES)).toEqual(runSeed(scenario, 0, 7, RULES));
  });

  test('різні номери дають різні моменти', () => {
    expect(tasksFor(scenario, k, 7)[0].r).not.toEqual(tasksFor(scenario, k, 8)[0].r);
  });

  test('вищий рівень містить заявки нижчого з тими самими моментами', () => {
    const both = scenarioOf([0.3, 0.6]);
    const low = tasksFor(both, both.levels[0].k, 3).filter((t) => t.source === 'TICKET');
    const high = tasksFor(both, both.levels[1].k, 3).filter((t) => t.source === 'TICKET');

    expect(high.slice(0, low.length)).toEqual(low);
  });
});
