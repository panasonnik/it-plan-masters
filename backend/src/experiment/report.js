'use strict';

const RULE_NAMES = {
  FIFO: 'FIFO',
  EDD: 'Джексона (EDD)',
  WSPT: 'Сміта (WSPT)',
  DYNAMIC_RATIO: 'Динамічний пріоритет',
};

function csvNumber(value) {
  if (typeof value !== 'number') return String(value);
  const rounded = Math.round(value * 1e6) / 1e6;
  return String(rounded === 0 ? 0 : rounded);
}

function toCsv(rows, columns) {
  const lines = [Object.keys(columns).join(',')];

  for (const row of rows) {
    lines.push(Object.values(columns).map((read) => csvNumber(read(row))).join(','));
  }

  return `${lines.join('\n')}\n`;
}

function runsCsv(records) {
  return toCsv(records, {
    level: (r) => r.rho,
    rho_measured: (r) => r.rhoActual,
    rule: (r) => r.algorithm,
    run: (r) => r.seed,
    Z: (r) => r.z,
    Z_unplanned: (r) => r.zUnplanned,
    Z_planned: (r) => r.zPlanned,
    S: (r) => r.s,
    U: (r) => r.u,
    last_completion_at: (r) => new Date(r.lastCompletion).toISOString(),
  });
}

function summaryCsv(summary) {
  return toCsv(summary, {
    level: (r) => r.rho,
    rho_measured: (r) => r.rhoActual,
    rule: (r) => r.algorithm,
    K: (r) => r.k,
    planned_share: (r) => r.plannedShare,
    N: (r) => r.n,
    mean_Z: (r) => r.mean,
    s: (r) => r.s,
    mean_low: (r) => r.low,
    mean_high: (r) => r.high,
    pilot_mean_Z: (r) => r.pilotMean,
    pilot_s: (r) => r.pilotS,
    epsilon: (r) => r.epsilon,
    N_formula: (r) => r.formula,
    capped_at_N_max: (r) => (r.capped ? 'yes' : 'no'),
    mean_Z_unplanned: (r) => r.meanUnplanned,
    mean_Z_planned: (r) => r.meanPlanned,
    mean_U: (r) => r.meanU,
    mean_S: (r) => r.meanS,
    mean_S_low: (r) => r.meanS - r.halfWidthS,
    mean_S_high: (r) => r.meanS + r.halfWidthS,
  });
}

function thesisNumber(value, digits = 0) {
  const [whole, fraction] = Math.abs(value).toFixed(digits).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${value < 0 ? '−' : ''}${grouped}${fraction ? `,${fraction}` : ''}`;
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `|${headers.map(() => '---').join('|')}|`,
    ...rows.map((cells) => `| ${cells.join(' | ')} |`),
  ].join('\n');
}

function ruleTable(summary, config, read) {
  const levels = [...new Set(summary.map((row) => row.rho))];

  return markdownTable(
    ['ρ', ...config.rules.map((rule) => RULE_NAMES[rule])],
    levels.map((rho) => [
      thesisNumber(rho, 1),
      ...config.rules.map((rule) => read(summary.find((row) => row.rho === rho && row.algorithm === rule))),
    ])
  );
}

function tablesMd(summary, config, scenario) {
  const percent = thesisNumber(config.confidence * 100, 1);
  const firstRule = summary.filter((row) => row.algorithm === config.rules[0]);
  const plannedRho = scenario.plannedMinutes / scenario.capacityMinutes;

  const loadTable = markdownTable(
    ['ρ', 'ρ виміряне', 'K, заявок', 'Частка планових робіт, %', 'N', 'U, %'],
    firstRule.map((row) => [
      thesisNumber(row.rho, 1),
      thesisNumber(row.rhoActual, 3),
      String(row.k),
      thesisNumber(row.plannedShare * 100, 1),
      String(row.n),
      thesisNumber(row.meanU * 100, 1),
    ])
  );

  return [
    '# Таблиці для пояснювальної записки',
    '',
    `ε = ${thesisNumber(config.epsilonPercent, 1)} % від середнього пілотної серії, імовірність ${percent} % ` +
      `(z = ${thesisNumber(config.z, 2)}), n₀ = ${config.pilotRuns}; N = max(n₀, ⌈(z·s/ε)²⌉) — найбільше серед правил рівня. ` +
      `Планові роботи самі дають ρ_план = ${thesisNumber(plannedRho, 3)}; N_прац = ${scenario.employees}.`,
    '',
    '## Рівні завантаженості',
    '',
    loadTable,
    '',
    `## Середні втрати Z̄ ± z·s/√N, людино-хвилин за період (імовірність ${percent} %)`,
    '',
    ruleTable(summary, config, (row) => `${thesisNumber(row.mean)} ± ${thesisNumber(row.high - row.mean)}`),
    '',
    '## Середнє квадратичне відхилення s, людино-хвилин',
    '',
    ruleTable(summary, config, (row) => thesisNumber(row.s)),
    '',
    '## Втрати через позапланові роботи Z̄_позапл, людино-хвилин',
    '',
    ruleTable(summary, config, (row) => thesisNumber(row.meanUnplanned)),
    '',
    '## Втрати через прострочене планове обслуговування Z̄_план, людино-хвилин',
    '',
    ruleTable(summary, config, (row) => thesisNumber(row.meanPlanned, 1)),
    '',
    `## Середній простій одного працівника S̄ = Z̄ / N_прац, хвилин за період (імовірність ${percent} %)`,
    '',
    ruleTable(summary, config, (row) => `${thesisNumber(row.meanS, 1)} ± ${thesisNumber(row.halfWidthS, 1)}`),
    '',
  ].join('\n');
}

module.exports = { RULE_NAMES, runsCsv, summaryCsv, tablesMd };
