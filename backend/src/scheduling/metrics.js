'use strict';

//формули (4.8)–(4.10)

const { workingMinutesBetween } = require('./calendar');
const { needAt } = require('./rules');

function round(value) {
  return Math.round(value * 100) / 100;
}

function computeMetrics(items, calendar) {
  let lossUnplanned = 0;
  let lossPlanned = 0;

  for (const item of items) {
    const loss = item.w * Math.max(0, workingMinutesBetween(needAt(item), item.completedAt, calendar));

    if (item.source === 'PLANNED') lossPlanned += loss;
    else lossUnplanned += loss;
  }

  return {
    //щоб Z = Z_позапл + Z_план
    totalWeightedLoss: round(round(lossUnplanned) + round(lossPlanned)),
    lossUnplanned: round(lossUnplanned),
    lossPlanned: round(lossPlanned),
  };
}

module.exports = { computeMetrics, round };
