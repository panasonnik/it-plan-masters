'use strict';

//лише на базі *_test
const config = require('./config');
const { pool } = require('./db');

const onTestDatabase = config.db.database.endsWith('_test');
const describeDb = onTestDatabase ? describe : describe.skip;

//зміни відкочуються
async function inRollback(callback) {
  const client = await pool.connect();
  const run = async (text, params) => (await client.query(text, params)).rows;
  try {
    await client.query('BEGIN');
    return await callback(run);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

const insertTask = (workType) =>
  `INSERT INTO tasks (source, equipment_id, work_type, estimated_minutes, people_count, release_at)
   VALUES ('TICKET', (SELECT min(equipment_id) FROM equipment), '${workType}', 30, 1, now()) RETURNING task_id`;

afterAll(() => pool.end());

describeDb('схема бази даних', () => {
  test('роботу з видом робіт, якого немає в work_types, створити не можна', async () => {
    const error = await inRollback((db) => db(insertTask('NO_SUCH_WORK'))).catch((err) => err);

    expect(error.code).toBe('23503');
    expect(error.constraint).toBe('fk_tasks_work_type');
  });

  test('symptoms, service_norms, maintenance_rules і tasks посилаються на work_types', async () => {
    const rows = await inRollback((db) =>
      db(`SELECT conrelid::regclass::text AS table_name FROM pg_constraint
           WHERE contype = 'f' AND confrelid = 'work_types'::regclass ORDER BY 1`)
    );

    expect(rows.map((row) => row.table_name)).toEqual(['maintenance_rules', 'service_norms', 'symptoms', 'tasks']);
  });

  test('notifications.task_id — зовнішній ключ: неіснуюча робота — помилка, видалення роботи обнуляє посилання', async () => {
    const missing = await inRollback((db) =>
      db("INSERT INTO notifications (user_id, type, task_id, title) VALUES ((SELECT min(user_id) FROM users), 'TICKET', -1, 'тест')")
    ).catch((err) => err);
    expect(missing.constraint).toBe('fk_notifications_task');

    const taskIdAfterDelete = await inRollback(async (db) => {
      const [task] = await db(insertTask('REPAIR'));
      const [note] = await db(
        "INSERT INTO notifications (user_id, type, task_id, title) VALUES ((SELECT min(user_id) FROM users), 'TICKET', $1, 'тест') RETURNING notification_id",
        [task.task_id]
      );
      await db('DELETE FROM tasks WHERE task_id = $1', [task.task_id]);
      const [after] = await db('SELECT task_id FROM notifications WHERE notification_id = $1', [note.notification_id]);
      return after.task_id;
    });
    expect(taskIdAfterDelete).toBeNull();
  });
});
