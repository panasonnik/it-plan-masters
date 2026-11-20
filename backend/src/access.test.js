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

test('працівник отримує власні заявки і заявки на закріплене за ним обладнання', async () => {
  query.mockResolvedValue([]);
  await call('GET', '/tickets/my', EMPLOYEE);

  const [sql, params] = query.mock.calls[0];
  expect(sql).toContain('tk.reported_by_user_id = $1');
  expect(sql).toContain('o.assigned_user_id = $1');
  expect(params).toEqual([3]);
});

test('працівник бачить своє обладнання і спільне, яким користується', async () => {
  query.mockResolvedValue([]);
  await call('GET', '/equipment/my', EMPLOYEE);

  const [sql, params] = query.mock.calls[0];
  expect(sql).toContain('o.assigned_user_id = $1');
  expect(sql).toContain('FROM equipment_consumers c WHERE c.equipment_id = o.equipment_id AND c.user_id = $1');
  expect(params).toEqual([3]);
});

test('заявку на чуже обладнання подати не можна — 403', async () => {
  query
    .mockResolvedValueOnce([{ work_type: 'REPAIR' }]) //симптом
    .mockResolvedValueOnce([]); //чуже обладнання

  const res = await call('POST', '/tickets', EMPLOYEE, { equipmentId: 1, symptomId: 1 });

  expect(res.status).toBe(403);
  expect(query.mock.calls[1][1]).toEqual([3, 1]);
});

//принтер бухгалтерії (6): споживачі — Петренко (3) і Шевчук (4); Бондар (5) ним не користується
const PRINTER = 6;
const STRANGER = signToken({ user_id: 5, role: 'EMPLOYEE' });

test('споживач спільного принтера подає на нього заявку — 201', async () => {
  query
    .mockResolvedValueOnce([{ work_type: 'REPAIR', label: 'Принтер зминає папір' }]) //симптом
    .mockResolvedValueOnce([{ '?column?': 1 }]); //Петренко — споживач принтера
  const calls = adminTicketTransaction();

  const res = await call('POST', '/tickets', EMPLOYEE, { equipmentId: PRINTER, symptomId: 1 });

  expect(res.status).toBe(201);
  const [sql, params] = query.mock.calls[1];
  expect(sql).toContain('equipment_consumers');
  expect(params).toEqual([3, PRINTER]);
  expect(calls.find((c) => c.sql.startsWith('INSERT INTO tickets')).params).toEqual([3, PRINTER, 1, null]);
});

test('сторонній працівник на спільний принтер заявку не подасть — 403', async () => {
  query
    .mockResolvedValueOnce([{ work_type: 'REPAIR' }]) //симптом
    .mockResolvedValueOnce([]); //Бондар не споживач і не власник

  const res = await call('POST', '/tickets', STRANGER, { equipmentId: PRINTER, symptomId: 1 });

  expect(res.status).toBe(403);
  expect(await res.json()).toEqual({ error: 'Ви не користуєтесь цим обладнанням — заявку на нього подати не можна' });
  expect(query.mock.calls[1][1]).toEqual([5, PRINTER]);
  expect(transaction).not.toHaveBeenCalled();
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

test('заявка адміністратора: подію записано в журнал, власників пристрою сповіщено (крім автора)', async () => {
  query.mockResolvedValueOnce([{ work_type: 'REPAIR', label: 'Не друкує' }]);
  const calls = adminTicketTransaction();

  await call('POST', '/tickets', ADMIN, { equipmentId: 8, symptomId: 1 });

  const inserts = calls.filter((c) => c.sql.includes('INSERT INTO notifications'));
  const log = inserts.find((c) => c.sql.includes("a.role = 'IT_ADMIN'"));
  const owners = inserts.find((c) => c.sql.includes("u.role = 'EMPLOYEE'"));
  expect(log.params).toEqual([9, 'TICKET_CREATED', 'Нова заявка', 'Не друкує']);
  expect(owners.params).toEqual([9, 'TICKET', 'Заявка №9: прийнято', 'Не друкує', 1]);
});

//обладнання 8 у базі: «Ноутбук Ткачук», номер 10400008
function identityTransaction() {
  const calls = [];
  transaction.mockImplementation((callback) =>
    callback(async (sql, params) => {
      calls.push({ sql, params });
      return sql.includes('SELECT tree_path') ? [{ tree_path: '.8.', name: 'Ноутбук Ткачук', inventory_number: '10400008' }] : [];
    })
  );
  return calls;
}

test('редагування з тими самими назвою і номером проходить, UPDATE їх не чіпає', async () => {
  const calls = identityTransaction();

  const res = await call('PATCH', '/equipment/8', ADMIN, { inventoryNumber: '10400008', name: 'Ноутбук Ткачук', equipmentTypeId: 4 });

  expect(res.status).toBe(200);
  const update = calls.find((c) => c.sql.includes('UPDATE equipment'));
  expect(update.sql).not.toMatch(/inventory_number|name =/);
  expect(update.params).toEqual([8, 4, null, null, null, null]);
});

test.each([
  ['назву', { inventoryNumber: '10400008', name: 'Інша назва' }],
  ['інвентарний номер', { inventoryNumber: '999', name: 'Ноутбук Ткачук' }],
])('змінити %s після створення не можна — 422 з поясненням', async (what, identity) => {
  const calls = identityTransaction();

  const res = await call('PATCH', '/equipment/8', ADMIN, { ...identity, equipmentTypeId: 4 });

  expect(res.status).toBe(422);
  expect(await res.json()).toEqual({ error: 'Назву та інвентарний номер обладнання не можна змінити після створення' });
  expect(calls.some((c) => c.sql.includes('UPDATE equipment'))).toBe(false);
});

function equipmentTransaction(path) {
  const calls = [];
  transaction.mockImplementation((callback) =>
    callback(async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('RETURNING equipment_id')) return [{ equipment_id: 40 }];
      return sql.includes('SELECT tree_path') ? [{ tree_path: path }] : [];
    })
  );
  return calls;
}

test('підрозділ зберігається лише для кореневого обладнання', async () => {
  const calls = equipmentTransaction('.4.');

  await call('POST', '/equipment', ADMIN, { inventoryNumber: '10400040', name: 'Монітор', equipmentTypeId: 5, parentEquipmentId: 4, departmentId: 2 });
  await call('POST', '/equipment', ADMIN, { inventoryNumber: '10400041', name: 'ПК', equipmentTypeId: 3, departmentId: 2 });

  const inserts = calls.filter((c) => c.sql.includes('INSERT INTO equipment'));
  expect(inserts[0].params.at(-1)).toBeNull();
  expect(inserts[1].params.at(-1)).toBe(2);
});

test('підрозділ з обладнанням не видалити — зрозуміле повідомлення', async () => {
  query.mockRejectedValueOnce(
    Object.assign(new Error('fk'), {
      code: '23503',
      constraint: 'fk_equipment_department',
      detail: 'Key (department_id)=(1) is still referenced from table "equipment".',
    })
  );

  const res = await call('DELETE', '/references/departments/1', ADMIN);

  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: 'До підрозділу прив’язане обладнання — спершу перенесіть його в інший підрозділ' });
  expect(query.mock.calls[0][0]).toContain('DELETE FROM departments');
});

test('інвентарний номер нового обладнання — лише цифри', async () => {
  const res = await call('POST', '/equipment', ADMIN, { inventoryNumber: 'PC-001', name: 'ПК', equipmentTypeId: 3 });

  expect(res.status).toBe(422);
  expect(await res.json()).toEqual({ error: 'Інвентарний номер має містити лише цифри' });
  expect(transaction).not.toHaveBeenCalled();
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
