'use strict';

//календар — робочі інтервали в мс

const MS_PER_MINUTE = 60 * 1000;

function toTime(value) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function calendarFromShifts(shifts) {
  const intervals = [];

  for (const shift of shifts) {
    const start = toTime(shift.startAt);
    const end = toTime(shift.endAt);
    if (!(end > start)) continue;

    const hasBreak = shift.breakStartAt && shift.breakEndAt;
    const breakStart = hasBreak ? toTime(shift.breakStartAt) : null;
    const breakEnd = hasBreak ? toTime(shift.breakEndAt) : null;

    if (hasBreak && breakStart > start && breakEnd < end) {
      intervals.push({ start, end: breakStart });
      intervals.push({ start: breakEnd, end });
    } else {
      intervals.push({ start, end });
    }
  }

  return intervals.sort((a, b) => a.start - b.start);
}

function workingMinutesOf(calendar) {
  return calendar.reduce((sum, interval) => sum + (interval.end - interval.start), 0) / MS_PER_MINUTE;
}

//робочі хвилини між моментами
function workingMinutesBetween(a, b, calendar) {
  const from = toTime(a);
  const to = toTime(b);

  if (to === from) return 0;
  if (to < from) return -workingMinutesBetween(b, a, calendar);

  let milliseconds = 0;

  for (const interval of calendar) {
    if (interval.start >= to) break;
    if (interval.end <= from) continue;
    milliseconds += Math.min(interval.end, to) - Math.max(interval.start, from);
  }

  return milliseconds / MS_PER_MINUTE;
}

function nextWorkingMoment(moment, calendar) {
  const time = toTime(moment);

  for (const interval of calendar) {
    if (interval.end > time) return Math.max(interval.start, time);
  }

  return time;
}

//обід і ніч — лише пауза
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

module.exports = {
  toTime,
  calendarFromShifts,
  workingMinutesOf,
  workingMinutesBetween,
  nextWorkingMoment,
  addWorkingMinutes,
};
