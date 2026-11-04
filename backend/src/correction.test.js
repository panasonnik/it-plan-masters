'use strict';

process.env.DATABASE = 'test';
process.env.DB_USER = 'test';
process.env.JWT_SECRET = 'test-secret-for-correction-tests';

const mockState = { task: null, updates: [], replanned: 0 };

//для SOFTWARE нормативу немає
const MOCK_NORMS = { REPAIR: 45, REPLACEMENT: 15 };

async function mockDb(sql, params = []) {
  if (sql.includes('FROM tasks WHERE task_id = $1 FOR UPDATE')) return mockState.task ? [mockState.task] : [];
  if (sql.includes('AS minutes')) return MOCK_NORMS[params[1]] ? [{ minutes: MOCK_NORMS[params[1]] }] : [];
  if (sql.startsWith('UPDATE tasks SET work_type')) {
    mockState.updates.push(params);
    return [];
  }
  if (sql.startsWith('DELETE FROM plan_items')) mockState.replanned += 1;
  if (sql.includes('FROM settings')) return [{ setting_value: 'WSPT' }];
  return [];
}

jest.mock('./db', () => ({
  query: (sql, params) => mockDb(sql, params),
  transaction: (callback) => callback(mockDb),
  pool: {},
}));

const app = require('./app');
const { signToken } = require('./auth');

const ADMIN = signToken({ user_id: 1, role: 'IT_ADMIN' });
let server;
let base;

beforeAll((done) => {
  server = app.listen(0, () => {
    base = `http://localhost:${server.address().port}/api`;
    done();
  });
});

afterAll((done) => {
  server.closeAllConnections();
  server.close(done);
});

beforeEach(() => {
  mockState.updates = [];
  mockState.replanned = 0;
});

function correct(body) {
  return fetch(`${base}/tasks/7`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN}` },
    body: JSON.stringify(body),
  });
}

test.each(['NEW', 'SCHEDULED'])('робота у статусі %s: тривалість — з нормативу нового виду, план перераховано', async (status) => {
  mockState.task = { task_id: 7, status, equipment_id: 14, work_type: 'REPAIR' };

  const res = await correct({ workType: 'REPLACEMENT', peopleCount: 3 });

  expect(res.status).toBe(200);
  expect(mockState.updates).toEqual([[7, 'REPLACEMENT', 15, 3]]);
  expect(mockState.replanned).toBe(1);
  expect(await res.json()).toHaveProperty('next');
});

test('розпочату роботу виправити не можна — причина одним рядком', async () => {
  mockState.task = { task_id: 7, status: 'IN_PROGRESS', equipment_id: 14, work_type: 'REPAIR' };

  const res = await correct({ workType: 'REPLACEMENT', peopleCount: 3 });

  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: 'Виправити роботу можна лише до її початку' });
  expect(mockState.updates).toEqual([]);
});

test('вид робіт без нормативу — 422 з поясненням, нічого не змінено', async () => {
  mockState.task = { task_id: 7, status: 'NEW', equipment_id: 14, work_type: 'REPAIR' };

  const res = await correct({ workType: 'SOFTWARE', peopleCount: 1 });

  expect(res.status).toBe(422);
  expect((await res.json()).error).toBe('Для цього виду робіт немає нормативу тривалості');
  expect(mockState.updates).toEqual([]);
});

test('кількість людей 0 — 422', async () => {
  mockState.task = { task_id: 7, status: 'NEW', equipment_id: 14, work_type: 'REPAIR' };

  const res = await correct({ workType: 'REPAIR', peopleCount: 0 });

  expect(res.status).toBe(422);
  expect(mockState.updates).toEqual([]);
});
