'use strict';

const { query } = require('../../db');
const repo = require('./reports.repository');
const { loadShifts, dateOf } = require('../plan/plan.service');
const { computeMetrics } = require('../../scheduling/metrics');
const { calendarFromShifts } = require('../../scheduling/calendar');
const { needAt } = require('../../scheduling/rules');

async function downtime(from, to) {
  const works = (await repo.findDoneBetween(query, from, to)).map((row) => ({ ...row, completedAt: row.finished_at }));

  //календар від найранішої потреби
  const earliest = Math.min(new Date(from).getTime(), ...works.map((work) => new Date(needAt(work)).getTime()));
  const calendar = calendarFromShifts(await loadShifts(query, dateOf(earliest), to));
  const metrics = computeMetrics(works, calendar);
  const employees = await repo.countActiveEmployees(query);

  return {
    from,
    to,
    works: works.length,
    z: metrics.totalWeightedLoss,
    zUnplanned: metrics.lossUnplanned,
    zPlanned: metrics.lossPlanned,
    employees,
    s: employees > 0 ? Math.round((metrics.totalWeightedLoss / employees) * 100) / 100 : null,
  };
}

module.exports = { downtime };
