# Фрагменти SQL

Усі таблиці — `backend/db/migrations/001_schema.sql`. Запити, що замінили колишні тригери й збережені функції, — у файлах `*.repository.js` модулів сервера.

## Таблиця `equipment`

Файл `backend/db/migrations/001_schema.sql`.

```sql
--tree_path: '.3.14.' — мишка 14 комп'ютера 3
--affected_people NULL: кількість людей пропонує система
CREATE TABLE equipment (
    equipment_id        serial  NOT NULL,
    inventory_number    text    NOT NULL,
    name                text    NOT NULL,
    equipment_type_id   integer NOT NULL,
    parent_equipment_id integer,
    assigned_user_id    integer,
    tree_path           text    NOT NULL DEFAULT '',
    affected_people     integer,
    CONSTRAINT pk_equipment PRIMARY KEY (equipment_id),
    CONSTRAINT uq_equipment_inventory_number UNIQUE (inventory_number),
    CONSTRAINT fk_equipment_type FOREIGN KEY (equipment_type_id) REFERENCES equipment_types (equipment_type_id),
    CONSTRAINT fk_equipment_parent FOREIGN KEY (parent_equipment_id) REFERENCES equipment (equipment_id),
    CONSTRAINT fk_equipment_assigned_user FOREIGN KEY (assigned_user_id) REFERENCES users (user_id),
    CONSTRAINT ck_equipment_affected_people CHECK (affected_people > 0)
);
```

## Таблиця `tickets`

Файл `backend/db/migrations/001_schema.sql`.

```sql
CREATE TABLE tickets (
    ticket_id           serial      NOT NULL,
    reported_by_user_id integer     NOT NULL,
    equipment_id        integer     NOT NULL,
    symptom_id          integer     NOT NULL,
    description         text,
    status              text        NOT NULL DEFAULT 'NEW',
    reject_reason       text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_tickets PRIMARY KEY (ticket_id),
    CONSTRAINT fk_tickets_reported_by FOREIGN KEY (reported_by_user_id) REFERENCES users (user_id),
    CONSTRAINT fk_tickets_equipment FOREIGN KEY (equipment_id) REFERENCES equipment (equipment_id),
    CONSTRAINT fk_tickets_symptom FOREIGN KEY (symptom_id) REFERENCES symptoms (symptom_id)
);
```

## Таблиця `tasks` і часткові унікальні індекси

Файл `backend/db/migrations/001_schema.sql`.

```sql
--p = estimated_minutes, n = people_count, r = release_at, d = due_at
CREATE TABLE tasks (
    task_id             serial      NOT NULL,
    source              text        NOT NULL,
    ticket_id           integer,
    maintenance_rule_id integer,
    equipment_id        integer     NOT NULL,
    work_type           text        NOT NULL,
    estimated_minutes   integer     NOT NULL,
    people_count        integer     NOT NULL,
    release_at          timestamptz NOT NULL,
    due_at              timestamptz,
    status              text        NOT NULL DEFAULT 'NEW',
    started_at          timestamptz,
    finished_at         timestamptz,
    actual_minutes      integer,
    CONSTRAINT pk_tasks PRIMARY KEY (task_id),
    CONSTRAINT fk_tasks_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (ticket_id),
    CONSTRAINT fk_tasks_maintenance_rule FOREIGN KEY (maintenance_rule_id) REFERENCES maintenance_rules (maintenance_rule_id) ON DELETE SET NULL,
    CONSTRAINT fk_tasks_equipment FOREIGN KEY (equipment_id) REFERENCES equipment (equipment_id),
    CONSTRAINT ck_tasks_source CHECK (source IN ('TICKET', 'PLANNED')),
    CONSTRAINT ck_tasks_estimated_minutes CHECK (estimated_minutes > 0),
    CONSTRAINT ck_tasks_people_count CHECK (people_count >= 1)
);

--одна відкрита робота одного виду на обладнанні
CREATE UNIQUE INDEX uq_tasks_open_ticket ON tasks (equipment_id, work_type)
    WHERE source = 'TICKET' AND status IN ('NEW', 'SCHEDULED', 'IN_PROGRESS');
CREATE UNIQUE INDEX uq_tasks_open_planned ON tasks (equipment_id, work_type)
    WHERE source = 'PLANNED' AND status IN ('NEW', 'SCHEDULED', 'IN_PROGRESS');

--виконується щонайбільше одна робота
CREATE UNIQUE INDEX uq_tasks_one_in_progress ON tasks (status) WHERE status = 'IN_PROGRESS';
```

## Таблиця `maintenance_rules`

Файл `backend/db/migrations/001_schema.sql`.

```sql
CREATE TABLE maintenance_rules (
    maintenance_rule_id serial  NOT NULL,
    equipment_id        integer NOT NULL,
    work_type           text    NOT NULL DEFAULT 'MAINTENANCE',
    period_days         integer NOT NULL,
    tolerance_days      integer NOT NULL DEFAULT 7,
    next_due_date       date    NOT NULL,
    CONSTRAINT pk_maintenance_rules PRIMARY KEY (maintenance_rule_id),
    CONSTRAINT fk_maintenance_rules_equipment FOREIGN KEY (equipment_id) REFERENCES equipment (equipment_id) ON DELETE CASCADE,
    CONSTRAINT ck_maintenance_rules_period CHECK (period_days > 0),
    CONSTRAINT ck_maintenance_rules_tolerance CHECK (tolerance_days >= 0)
);
```

## Таблиця `service_norms`

Файл `backend/db/migrations/001_schema.sql`.

```sql
CREATE TABLE service_norms (
    service_norm_id         serial  NOT NULL,
    equipment_type_id       integer NOT NULL,
    work_type               text    NOT NULL,
    seed_minutes            integer NOT NULL,
    observed_median_minutes integer,
    sample_count            integer NOT NULL DEFAULT 0,
    CONSTRAINT pk_service_norms PRIMARY KEY (service_norm_id),
    CONSTRAINT uq_service_norms_type_work UNIQUE (equipment_type_id, work_type),
    CONSTRAINT fk_service_norms_equipment_type FOREIGN KEY (equipment_type_id) REFERENCES equipment_types (equipment_type_id),
    CONSTRAINT ck_service_norms_seed CHECK (seed_minutes > 0)
);
```

## Таблиця `plan_items` — план на сьогодні

Файл `backend/db/migrations/001_schema.sql`.

```sql
CREATE TABLE plan_items (
    task_id                 integer     NOT NULL,
    position                integer     NOT NULL,
    planned_start_at        timestamptz NOT NULL,
    planned_end_at          timestamptz NOT NULL,
    group_root_equipment_id integer,
    CONSTRAINT pk_plan_items PRIMARY KEY (task_id),
    CONSTRAINT fk_plan_items_task FOREIGN KEY (task_id) REFERENCES tasks (task_id) ON DELETE CASCADE,
    CONSTRAINT fk_plan_items_group_root FOREIGN KEY (group_root_equipment_id) REFERENCES equipment (equipment_id) ON DELETE SET NULL
);
```

## Шлях у дереві обладнання `tree_path`

Під час створення вузла: шлях батька + власний номер. Під час перенесення шляхи вузла і всіх нащадків переписує один UPDATE:

Файл `backend/src/modules/equipment/equipment.service.js`.

```js
//шлях батька + власний номер; для кореня '.номер.'
async function pathFor(db, equipmentId, parentId) {
  if (parentId === null) return `.${equipmentId}.`;

  const parentPath = await repo.findPath(db, parentId);
  if (!parentPath) throw httpError(422, 'Батьківське обладнання не знайдено');
  //перевірка циклу
  if (parentPath.includes(`.${equipmentId}.`)) throw httpError(422, 'Не можна перемістити вузол у його власне піддерево');

  return `${parentPath}${equipmentId}.`;
}
```

```sql
UPDATE equipment SET tree_path = $2 || substring(tree_path FROM length($1) + 1)
 WHERE tree_path LIKE $1 || '%'
```

## Кількість людей, яку пропонує система, — формула (4.5)

Файл `backend/src/modules/equipment/equipment.repository.js`.

```js
//формула (4.5): max(1, |⋃ M(x)|) по піддереву вузла
const PROPOSED_PEOPLE = `(
  SELECT GREATEST(1, count(DISTINCT x.user_id))::int FROM (
    SELECT s.assigned_user_id AS user_id FROM equipment s
     WHERE s.tree_path LIKE e.tree_path || '%' AND s.assigned_user_id IS NOT NULL
    UNION
    SELECT c.user_id FROM equipment_consumers c JOIN equipment s USING (equipment_id)
     WHERE s.tree_path LIKE e.tree_path || '%'
  ) x
)`;
```

## Тривалість за нормативом — формула (4.3)

Файл `backend/src/modules/references/references.repository.js`.

```js
//медіана фактичного часу, коли вимірювань достатньо, інакше початкова оцінка
const NORM_SQL = `CASE WHEN n.sample_count >= (SELECT setting_value::int FROM settings WHERE setting_key = 'NORM_MIN_SAMPLES')
                       AND n.observed_median_minutes IS NOT NULL
                      THEN n.observed_median_minutes ELSE n.seed_minutes END`;
```

## Перерахунок медіани нормативу після «Готово»

Файл `backend/src/modules/references/references.repository.js`. Викликається з
`completeTask()` (`tasks.service.js`) у тій самій транзакції, що й позначка DONE.

```js
//медіана фактичного часу для пари «тип обладнання, вид робіт»
function refreshNormMedian(db, equipmentId, workType) {
  return db(
    `UPDATE service_norms n
        SET observed_median_minutes = GREATEST(1, round(o.median)::int), sample_count = o.samples
       FROM (SELECT e.equipment_type_id, t.work_type,
                    percentile_cont(0.5) WITHIN GROUP (ORDER BY t.actual_minutes) AS median, count(*) AS samples
               FROM tasks t JOIN equipment e USING (equipment_id)
              WHERE t.status = 'DONE' AND t.actual_minutes > 0
                AND e.equipment_type_id = (SELECT equipment_type_id FROM equipment WHERE equipment_id = $1) AND t.work_type = $2
              GROUP BY e.equipment_type_id, t.work_type) o
      WHERE n.equipment_type_id = o.equipment_type_id AND n.work_type = o.work_type`,
    [equipmentId, workType]
  );
}
```

## Робочі зміни за датами з тижневого розкладу

Файл `backend/src/modules/plan/plan.repository.js`.

```js
//зміни за датами з тижневого розкладу
function findShifts(db, fromDate, toDate) {
  return db(
    `SELECT to_char(d, 'YYYY-MM-DD') AS day,
            (d::date + w.start_time)::timestamptz AS start_at, (d::date + w.end_time)::timestamptz AS end_at,
            (d::date + w.break_start)::timestamptz AS break_start_at, (d::date + w.break_end)::timestamptz AS break_end_at
       FROM generate_series($1::date, $2::date, interval '1 day') d
       JOIN work_hours w ON w.day_of_week = EXTRACT(isodow FROM d)
      ORDER BY d`,
    [fromDate, toDate]
  );
}
```
