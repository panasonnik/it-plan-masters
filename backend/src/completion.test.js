'use strict';

process.env.DATABASE = 'test';
process.env.DB_USER = 'test';
process.env.JWT_SECRET = 'test-secret-for-completion-tests';

const mockState = { task: null, inTransaction: [], outside: [] };

function mockAnswer(sql) {
  if (sql.includes('FROM tasks WHERE task_id = $1 FOR UPDATE')) return mockState.task ? [mockState.task] : [];
  if (sql.includes('FROM settings')) return [{ setting_value: 'WSPT' }];
  return [];
}

jest.mock('./db', () => ({
  query: async (sql, params) => {
    mockState.outside.push({ sql, params });
    return mockAnswer(sql);
  },
  transaction: async (callback) => {
    const calls = [];
    const result = await callback(async (sql, params) => {
      calls.push({ sql, params });
      return mockAnswer(sql);
    });
    mockState.inTransaction.push(calls);
    return result;
  },
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
  mockState.inTransaction = [];
  mockState.outside = [];
});

function complete(actualMinutes) {
  return fetch(`${base}/tasks/7/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN}` },
    body: JSON.stringify({ actualMinutes }),
  });
}

const isMedianUpdate = (call) => call.sql.includes('UPDATE service_norms');

test('«Готово»: медіану пари «тип обладнання, вид робіт» перераховано в тій самій транзакції', async () => {
  mockState.task = { task_id: 7, status: 'IN_PROGRESS', equipment_id: 14, work_type: 'REPAIR', maintenance_rule_id: null };

  const res = await complete(40);

  expect(res.status).toBe(200);
  const [completion] = mockState.inTransaction;
  const done = completion.findIndex((call) => call.sql.includes("SET status = 'DONE'"));
  const median = completion.findIndex(isMedianUpdate);
  expect(done).toBeGreaterThanOrEqual(0);
  expect(median).toBeGreaterThan(done);
  expect(completion[median].params).toEqual([14, 'REPAIR']);
  expect(mockState.outside.some(isMedianUpdate)).toBe(false);
});

test('нерозпочату роботу завершити не можна — медіана не змінюється', async () => {
  mockState.task = { task_id: 7, status: 'SCHEDULED', equipment_id: 14, work_type: 'REPAIR', maintenance_rule_id: null };

  const res = await complete(40);

  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: 'Роботу ще не розпочато' });
  expect(mockState.inTransaction.flat().some(isMedianUpdate)).toBe(false);
});
