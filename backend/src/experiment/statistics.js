'use strict';

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

//похибка округлення
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

module.exports = { Z_OF_CONFIDENCE, mean, standardDeviation, runsByFormula, requiredRuns, halfWidth };
