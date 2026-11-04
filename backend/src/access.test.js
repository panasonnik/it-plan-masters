'use strict';

process.env.DATABASE = 'test';
process.env.DB_USER = 'test';
process.env.JWT_SECRET = 'test-secret-for-access-tests';

jest.mock('./db', () => ({ query: jest.fn(), transaction: jest.fn(), pool: {} }));

const { query, transaction } = require('./db');
const app = require('./app');
const { signToken } = require('./auth');

const EMPLOYEE = signToken({ user_id: 3, role: 'EMPLOYEE' });
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
  query.mockReset();
  transaction.mockReset();
});

function call(method, path, token, body) {
  return fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test('без входу — 401', async () => {
  expect((await call('GET', '/tickets/my')).status).toBe(401);
});

test.each([
  ['GET', '/users'],
  ['GET', '/tickets'],
  ['GET', '/plan'],
  ['POST', '/tasks/1/start'],
  ['GET', '/references/norms'],
  ['GET', '/reports/downtime?from=2026-10-01&to=2026-10-31'],
])('працівнику недоступно %s %s — 403', async (method, path) => {
  expect((await call(method, path, EMPLOYEE)).status).toBe(403);
  expect(query).not.toHaveBeenCalled();
});

test('працівник отримує лише власні заявки', async () => {
  query.mockResolvedValue([]);
  await call('GET', '/tickets/my', EMPLOYEE);

  const [sql, params] = query.mock.calls[0];
  expect(sql).toContain('tk.reported_by_user_id = $1');
  expect(params).toEqual([3]);
});

test('працівник бачить лише своє обладнання', async () => {
  query.mockResolvedValue([]);
  await call('GET', '/equipment/my', EMPLOYEE);

  const [sql, params] = query.mock.calls[0];
  expect(sql).toContain('o.assigned_user_id = $1');
  expect(params).toEqual([3]);
});

test('заявку на чуже обладнання подати не можна — 403', async () => {
  query
    .mockResolvedValueOnce([{ work_type: 'REPAIR' }]) //симптом
    .mockResolvedValueOnce([]); //чуже обладнання

  const res = await call('POST', '/tickets', EMPLOYEE, { equipmentId: 1, symptomId: 1 });

  expect(res.status).toBe(403);
  expect(query.mock.calls[1][1]).toEqual([1, 3]);
});

//норматив 45 хв, людей 2
function adminTicketTransaction() {
  const calls = [];
  transaction.mockImplementation((callback) =>
    callback(async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('AS minutes')) return [{ minutes: 45 }];
      if (sql.includes('RETURNING ticket_id')) return [{ ticket_id: 9 }];
      if (sql.includes('AS n FROM')) return [{ n: 2 }];
      return [];
    })
  );
  return calls;
}

test('адміністратор подає заявку на будь-яке обладнання — закріплення не перевіряється', async () => {
  query.mockResolvedValueOnce([{ work_type: 'REPAIR' }]); //симптом
  adminTicketTransaction();

  const res = await call('POST', '/tickets', ADMIN, { equipmentId: 8, symptomId: 1 });

  expect(res.status).toBe(201);
  expect(await res.json()).toEqual({ ticket_id: 9 });
  expect(query).toHaveBeenCalledTimes(1);
});

test('заявка адміністратора: автор — адміністратор, тривалість і кількість людей обчислює сервер', async () => {
  query.mockResolvedValueOnce([{ work_type: 'REPAIR' }]);
  const calls = adminTicketTransaction();

  await call('POST', '/tickets', ADMIN, { equipmentId: 8, symptomId: 1, description: 'Повідомили телефоном' });

  const ticket = calls.find((c) => c.sql.startsWith('INSERT INTO tickets'));
  const task = calls.find((c) => c.sql.includes('INSERT INTO tasks'));
  expect(ticket.params).toEqual([1, 8, 1, 'Повідомили телефоном']);
  expect(task.params).toEqual([9, 8, 'REPAIR', 45, 2]);
});

test('види робіт: адміністратор отримує список з довідника, працівнику — 403', async () => {
  query.mockResolvedValue([{ work_type: 'REPAIR', name: 'Ремонт' }]);

  const res = await call('GET', '/references/work-types', ADMIN);

  expect(await res.json()).toEqual([{ work_type: 'REPAIR', name: 'Ремонт' }]);
  expect(query.mock.calls[0][0]).toContain('FROM work_types');
  expect((await call('GET', '/references/work-types', EMPLOYEE)).status).toBe(403);
});

test('симптом з видом робіт, якого немає в довіднику, — 422', async () => {
  query.mockRejectedValueOnce(
    Object.assign(new Error('fk'), { code: '23503', detail: 'Key (work_type)=(NO_SUCH) is not present in table "work_types".' })
  );

  const res = await call('POST', '/references/symptoms', ADMIN, { label: 'Тест', equipment_type_id: null, work_type: 'NO_SUCH' });

  expect(res.status).toBe(422);
  expect(await res.json()).toEqual({ error: 'Обраного значення немає в довіднику' });
});

test('чуже сповіщення не позначити прочитаним: запит обмежено власним user_id', async () => {
  query.mockResolvedValue([]);
  await call('POST', '/notifications/7/read', EMPLOYEE);

  expect(query.mock.calls[0][1]).toEqual([7, 3]);
});
