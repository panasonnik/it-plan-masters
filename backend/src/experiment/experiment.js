'use strict';

const { runSeed } = require('./run');
const { mean, standardDeviation, runsByFormula, requiredRuns, halfWidth } = require('./statistics');

function recordsOf(records, levelIndex, algorithm, count) {
  return records
    .filter((r) => r.levelIndex === levelIndex && r.algorithm === algorithm && r.seed <= count)
    .sort((a, b) => a.seed - b.seed);
}

function runRange(scenario, levelIndex, seedFrom, seedTo, rules, records) {
  for (let seed = seedFrom; seed <= seedTo; seed += 1) {
    records.push(...runSeed(scenario, levelIndex, seed, rules));
  }
}

function planLevel(records, levelIndex, config) {
  const pilots = config.rules.map((algorithm) => {
    const values = recordsOf(records, levelIndex, algorithm, config.pilotRuns).map((r) => r.z);
    const pilotMean = mean(values);
    const pilotS = standardDeviation(values);
    const epsilon = (config.epsilonPercent / 100) * Math.abs(pilotMean);

    return {
      algorithm,
      pilotMean,
      pilotS,
      epsilon,
      formula: runsByFormula(pilotS, epsilon, config.z),
      required: requiredRuns(pilotS, epsilon, config.z, config.pilotRuns),
    };
  });

  const n = Math.max(config.pilotRuns, ...pilots.map((p) => Math.min(p.required, config.maxRuns)));
  return { levelIndex, n, pilots };
}

function summarizeLevel(records, scenario, plan, config) {
  const level = scenario.levels[plan.levelIndex];

  return plan.pilots.map((pilot) => {
    const list = recordsOf(records, plan.levelIndex, pilot.algorithm, plan.n);
    const values = list.map((r) => r.z);
    const average = mean(values);
    const s = standardDeviation(values);
    const width = halfWidth(s, plan.n, config.z);
    const averageOf = (field) => mean(list.map((r) => r[field]));

    return {
      ...pilot,
      rho: level.rho,
      rhoActual: level.rhoActual,
      k: level.k,
      plannedShare: level.plannedShare,
      n: plan.n,
      capped: pilot.required > config.maxRuns,
      mean: average,
      s,
      low: average - width,
      high: average + width,
      meanUnplanned: averageOf('zUnplanned'),
      meanPlanned: averageOf('zPlanned'),
      meanU: averageOf('u'),
      meanS: average / scenario.employees,
      halfWidthS: width / scenario.employees,
    };
  });
}

function runExperiment(scenario, config, log = () => {}) {
  const records = [];
  const levels = scenario.levels.map((level) => level.index);

  log(`pilot: ${config.pilotRuns} runs per level and rule`);
  for (const index of levels) runRange(scenario, index, 1, config.pilotRuns, config.rules, records);

  const plans = levels.map((index) => planLevel(records, index, config));
  log(`main: ${plans.map((plan) => `ρ=${scenario.levels[plan.levelIndex].rho} → N=${plan.n}`).join(', ')}`);
  for (const plan of plans) runRange(scenario, plan.levelIndex, config.pilotRuns + 1, plan.n, config.rules, records);

  //серія B для збіжності
  const convergenceN = Math.max(...plans.map((plan) => plan.n));
  log(`convergence: runs up to ${2 * convergenceN}`);
  for (const plan of plans) runRange(scenario, plan.levelIndex, plan.n + 1, 2 * convergenceN, config.rules, records);

  const ruleIndex = (algorithm) => config.rules.indexOf(algorithm);
  records.sort(
    (a, b) => a.levelIndex - b.levelIndex || ruleIndex(a.algorithm) - ruleIndex(b.algorithm) || a.seed - b.seed
  );

  return {
    records,
    summary: plans.flatMap((plan) => summarizeLevel(records, scenario, plan, config)),
    convergenceN,
  };
}

module.exports = { runExperiment };
