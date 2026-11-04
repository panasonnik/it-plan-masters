'use strict';

//генератор парка–міллера

const MODULUS = 2147483647;
const MULTIPLIER = 16807;

const STREAM_LENGTH = 100000;
const MAX_SEED = Math.floor((MODULUS - 1) / STREAM_LENGTH) - 1;

function modPow(base, exponent, modulus) {
  let result = 1n;
  let factor = base % modulus;
  let rest = exponent;

  while (rest > 0n) {
    if (rest % 2n === 1n) result = (result * factor) % modulus;
    factor = (factor * factor) % modulus;
    rest /= 2n;
  }

  return result;
}

function toUnit(state) {
  return (state - 1) / (MODULUS - 1);
}

//у кожного прогону свій шматок
function createStream(seed) {
  if (!Number.isInteger(seed) || seed < 1 || seed > MAX_SEED) {
    throw new Error(`Run number must be 1..${MAX_SEED}, got ${seed}`);
  }

  const exponent = BigInt(seed) * BigInt(STREAM_LENGTH);
  let state = Number(modPow(BigInt(MULTIPLIER), exponent, BigInt(MODULUS)));
  let used = 0;

  return function next() {
    used += 1;
    if (used > STREAM_LENGTH) throw new Error(`Run ${seed} used more than ${STREAM_LENGTH} numbers`);

    state = (state * MULTIPLIER) % MODULUS;
    return toUnit(state);
  };
}

function createGenerator(seed, offset = 0) {
  let state = seed % MODULUS;
  if (state <= 0) state += MODULUS - 1;

  if (offset > 0) {
    state = Number((BigInt(state) * modPow(BigInt(MULTIPLIER), BigInt(offset), BigInt(MODULUS))) % BigInt(MODULUS));
  }

  return function next() {
    state = (state * MULTIPLIER) % MODULUS;
    return toUnit(state);
  };
}

module.exports = { MAX_SEED, createStream, createGenerator };
