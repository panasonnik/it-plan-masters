'use strict';

function findDoneBetween(db, from, to) {
  return db(
    `SELECT estimated_minutes AS p, people_count AS w, release_at AS r, due_at AS d, source, finished_at
       FROM tasks WHERE status = 'DONE' AND finished_at >= $1::date AND finished_at < $2::date + 1`,
    [from, to]
  );
}

async function countActiveEmployees(db) {
  const [{ employees }] = await db("SELECT count(*)::int AS employees FROM users WHERE role = 'EMPLOYEE' AND is_active");
  return employees;
}

module.exports = { findDoneBetween, countActiveEmployees };
