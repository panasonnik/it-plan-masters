--демо-історія для звіту «Втрати часу»: 9 тижнів до вчорашнього дня
--один адміністратор, роботи не перетинаються, Пн–Пт 09:00–13:00 і 14:00–18:00
--рядки згенеровано заздалегідь; день задано як «N-й робочий день тому» (1 — останній перед сьогодні)

CREATE TEMP TABLE demo_days ON COMMIT DROP AS
SELECT d::date AS day, (row_number() OVER (ORDER BY d DESC))::int AS back
  FROM generate_series(CURRENT_DATE - 90, CURRENT_DATE - 1, interval '1 day') d
 WHERE EXTRACT(isodow FROM d) < 6;

--заявки: подання, внесення в план, початок, фактичні хвилини або відхилення
CREATE TEMP TABLE demo_tickets ON COMMIT DROP AS
SELECT r.no, r.equipment_id, r.reporter, r.description, r.reason, r.actual_minutes,
       s.symptom_id, s.work_type,
       (cd.day + r.created_time::time)::timestamptz AS created_at,
       (pd.day + r.scheduled_time::time)::timestamptz AS scheduled_at,
       (sd.day + r.started_time::time)::timestamptz AS started_at,
       (sd.day + r.started_time::time)::timestamptz + make_interval(mins => r.actual_minutes) AS finished_at,
       (rd.day + r.rejected_time::time)::timestamptz AS rejected_at,
       NULL::integer AS ticket_id
  FROM (VALUES
  (1, 10, 'Комп''ютер дуже гуде і гріється', 7, NULL, 45, '14:21', 45, '14:22', 45, '14:28', 43, NULL, NULL, NULL),
  (2, 21, 'Файли з диска відкриваються дуже довго', 4, NULL, 43, '12:49', 43, '12:50', 43, '14:00', 14, NULL, NULL, NULL),
  (3, 5, 'Комп''ютер дуже гуде і гріється', 4, NULL, 43, '13:04', 43, '14:14', 43, '14:22', 47, NULL, NULL, NULL),
  (4, 5, 'Комп''ютер дуже гуде і гріється', 1, 'Повідомили телефоном', 42, '15:38', 42, '15:39', 42, '15:47', 51, NULL, NULL, NULL),
  (5, 6, 'Не друкує, хоча ввімкнений', 4, 'Вчора теж таке було', 41, '11:27', 41, '11:28', 41, '11:40', 18, NULL, NULL, NULL),
  (6, 6, 'Принтер зминає папір', 4, NULL, 40, '12:14', 40, '12:15', 40, '12:27', 29, NULL, NULL, NULL),
  (7, 6, 'Інше — опишу словами', 4, 'Не працює, як раніше', 40, '16:05', 40, '16:06', 40, '16:11', 15, NULL, NULL, NULL),
  (8, 6, 'Не друкує, хоча ввімкнений', 3, 'Терміново, готую звіт', 39, '11:57', 39, '11:58', 39, '12:04', 18, NULL, NULL, NULL),
  (9, 6, 'Принтер зминає папір', 3, NULL, 37, '10:12', 37, '10:13', 37, '10:24', 19, NULL, NULL, NULL),
  (10, 6, 'Не друкує, хоча ввімкнений', 4, NULL, 37, '10:19', NULL, NULL, NULL, NULL, NULL, 37, '10:35', 'Дубль заявки'),
  (11, 25, 'Комп''ютер повідомляє про помилку диска', 5, 'Терміново, готую звіт', 37, '14:24', 37, '14:25', 37, '14:46', 9, NULL, NULL, NULL),
  (12, 6, 'Не сканує в папку', 3, NULL, 34, '14:23', 34, '14:24', 34, '14:55', 15, NULL, NULL, NULL),
  (13, 6, 'Не друкує, хоча ввімкнений', 4, 'Терміново, готую звіт', 33, '14:22', 33, '14:23', 33, '14:36', 16, NULL, NULL, NULL),
  (14, 1, 'Не відкривається спільна папка або 1С', 3, 'Не відкривається 1С ні в кого в бухгалтерії', 32, '10:04', 32, '10:05', 32, '10:13', 51, NULL, NULL, NULL),
  (15, 9, 'З''являється реклама і сторонні вікна', 8, NULL, 32, '14:08', 32, '14:09', 32, '14:11', 51, NULL, NULL, NULL),
  (16, 5, 'Windows не встановлює оновлення', 1, 'Повідомили телефоном', 30, '11:52', 30, '11:53', 30, '12:02', 33, NULL, NULL, NULL),
  (17, 10, 'Комп''ютер дуже гуде і гріється', 7, NULL, 30, '17:01', 30, '17:02', 30, '17:06', 37, NULL, NULL, NULL),
  (18, 16, 'Файли з диска відкриваються дуже довго', 1, 'Повідомили телефоном', 29, '10:26', 29, '10:39', 29, '10:42', 18, NULL, NULL, NULL),
  (19, 9, 'Ноутбук не заряджається або швидко сідає', 8, 'Вчора теж таке було', 28, '13:52', 28, '13:53', 28, '14:00', 86, NULL, NULL, NULL),
  (20, 27, 'Блок живлення пахне горілим', 5, NULL, 28, '15:01', 28, '15:26', 28, '15:34', 44, NULL, NULL, NULL),
  (21, 7, 'Інше — опишу словами', 1, 'Повідомили телефоном', 26, '12:19', 26, '12:20', 26, '12:23', 17, NULL, NULL, NULL),
  (22, 7, 'Комп''ютер сам вимикається або перезавантажується', 5, NULL, 26, '14:06', 26, '14:07', 26, '14:14', 18, NULL, NULL, NULL),
  (23, 4, 'Комп''ютер сам вимикається або перезавантажується', 3, NULL, 25, '12:46', 25, '12:47', 25, '14:00', 16, NULL, NULL, NULL),
  (24, 7, 'Потрібно встановити програму', 5, 'Потрібен M.E.Doc', 24, '10:08', 24, '12:32', 24, '14:00', 20, NULL, NULL, NULL),
  (25, 9, 'Пише, що на диску закінчилося місце', 8, NULL, 24, '16:06', 24, '16:07', 24, '16:15', 12, NULL, NULL, NULL),
  (26, 5, 'Потрібно встановити програму', 4, 'Терміново, готую звіт', 22, '09:49', 22, '09:50', 22, '09:52', 28, NULL, NULL, NULL),
  (27, 28, 'Немає зображення, хоча комп''ютер працює', 1, 'Повідомили телефоном', 21, '12:13', 21, '12:14', 21, '12:24', 7, NULL, NULL, NULL),
  (28, 10, 'Інше — опишу словами', 7, 'Не працює, як раніше', 19, '13:49', 19, '13:50', 19, '14:00', 16, NULL, NULL, NULL),
  (29, 24, 'Немає зображення, хоча комп''ютер працює', 4, NULL, 19, '11:40', NULL, NULL, NULL, NULL, NULL, 19, '12:02', 'Не несправність — монітор був вимкнений'),
  (30, 25, 'Комп''ютер повідомляє про помилку диска', 5, NULL, 19, '17:22', 19, '17:23', 19, '17:27', 8, NULL, NULL, NULL),
  (31, 25, 'Комп''ютер повідомляє про помилку диска', 5, NULL, 18, '09:36', 18, '09:37', 18, '09:40', 9, NULL, NULL, NULL),
  (32, 5, 'Потрібно встановити програму', 1, 'Повідомили телефоном', 16, '09:23', 16, '09:24', 16, '09:28', 26, NULL, NULL, NULL),
  (33, 7, 'Не працює USB-роз''єм', 5, NULL, 16, '12:44', 16, '12:45', 16, '14:00', 57, NULL, NULL, NULL),
  (34, 9, 'Потрібно встановити програму', 8, 'На завтра, для зустрічі з клієнтом', 15, '17:41', 14, '09:00', 14, '09:42', 24, NULL, NULL, NULL),
  (35, 4, 'Інше — опишу словами', 1, 'Повідомили телефоном', 14, '09:57', 14, '10:06', 14, '10:12', 16, NULL, NULL, NULL),
  (36, 36, 'Зображення мерехтить або йде смугами', 7, 'Вчора теж таке було', 13, '10:43', 13, '10:44', 13, '10:58', 22, NULL, NULL, NULL),
  (37, 24, 'Немає зображення, хоча комп''ютер працює', 4, NULL, 13, '12:39', 13, '12:40', 13, '14:00', 12, NULL, NULL, NULL),
  (38, 15, 'Комп''ютер повідомляє про помилку диска', 3, NULL, 11, '10:00', 11, '10:01', 11, '10:49', 8, NULL, NULL, NULL),
  (39, 19, 'Немає зображення, хоча комп''ютер працює', 1, 'Повідомили телефоном', 10, '11:40', 10, '11:41', 10, '11:47', 12, NULL, NULL, NULL),
  (40, 33, 'Файли з диска відкриваються дуже довго', 7, NULL, 10, '17:47', 9, '09:00', 9, '09:36', 19, NULL, NULL, NULL),
  (41, 2, 'Немає інтернету і мережі на кількох комп''ютерах', 5, 'Немає інтернету у всьому офісі', 8, '14:22', 8, '14:23', 8, '14:37', 24, NULL, NULL, NULL),
  (42, 6, 'Інше — опишу словами', 3, 'Після обіду', 7, '09:28', 7, '09:29', 7, '09:43', 13, NULL, NULL, NULL),
  (43, 28, 'Зображення мерехтить або йде смугами', 5, 'Терміново, готую звіт', 5, '15:10', 5, '15:11', 5, '15:16', 22, NULL, NULL, NULL),
  (44, 10, 'Програма не запускається або видає помилку', 7, 'Після обіду', 4, '09:42', 4, '09:43', 4, '09:47', 22, NULL, NULL, NULL),
  (45, 3, 'Не друкує, хоча ввімкнений', 7, NULL, 4, '15:05', NULL, NULL, NULL, NULL, NULL, 4, '15:33', 'Не несправність — у лотку закінчився папір'),
  (46, 8, 'Потрібно встановити програму', 1, 'Повідомили телефоном', 2, '09:42', 2, '09:43', 2, '09:48', 39, NULL, NULL, NULL),
  (47, 25, 'Комп''ютер повідомляє про помилку диска', 5, 'Терміново, готую звіт', 2, '12:22', 2, '12:23', 2, '12:33', 15, NULL, NULL, NULL),
  (48, 36, 'Зображення мерехтить або йде смугами', 7, NULL, 1, '14:43', 1, '14:44', 1, '15:21', 19, NULL, NULL, NULL)
       ) r(no, equipment_id, symptom, reporter, description, created_back, created_time, scheduled_back, scheduled_time,
           started_back, started_time, actual_minutes, rejected_back, rejected_time, reason)
  JOIN equipment e USING (equipment_id)
  JOIN symptoms s ON s.label = r.symptom AND (s.equipment_type_id = e.equipment_type_id OR s.equipment_type_id IS NULL)
  JOIN demo_days cd ON cd.back = r.created_back
  LEFT JOIN demo_days pd ON pd.back = r.scheduled_back
  LEFT JOIN demo_days sd ON sd.back = r.started_back
  LEFT JOIN demo_days rd ON rd.back = r.rejected_back;

WITH created AS (
  INSERT INTO tickets (reported_by_user_id, equipment_id, symptom_id, description, status, reject_reason, created_at)
  SELECT reporter, equipment_id, symptom_id, description, CASE WHEN reason IS NULL THEN 'DONE' ELSE 'REJECTED' END, reason, created_at
    FROM demo_tickets ORDER BY no
  RETURNING ticket_id, equipment_id, created_at
)
UPDATE demo_tickets d SET ticket_id = c.ticket_id
  FROM created c
 WHERE c.equipment_id = d.equipment_id AND c.created_at = d.created_at;

INSERT INTO tasks (source, ticket_id, equipment_id, work_type, estimated_minutes, people_count, release_at, status,
                   started_at, finished_at, actual_minutes)
SELECT 'TICKET', d.ticket_id, d.equipment_id, d.work_type, n.seed_minutes, COALESCE(e.affected_people, (
           SELECT GREATEST(1, count(DISTINCT x.user_id))::int FROM (
             SELECT s.assigned_user_id AS user_id FROM equipment s
              WHERE s.tree_path LIKE e.tree_path || '%' AND s.assigned_user_id IS NOT NULL
             UNION
             SELECT c.user_id FROM equipment_consumers c JOIN equipment s USING (equipment_id)
              WHERE s.tree_path LIKE e.tree_path || '%'
           ) x)),
       d.created_at, CASE WHEN d.reason IS NULL THEN 'DONE' ELSE 'CANCELLED' END,
       d.started_at, d.finished_at, d.actual_minutes
  FROM demo_tickets d
  JOIN equipment e USING (equipment_id)
  JOIN service_norms n ON n.equipment_type_id = e.equipment_type_id AND n.work_type = d.work_type
 ORDER BY d.no;

INSERT INTO ticket_history (ticket_id, status, comment, changed_at)
SELECT ticket_id, status, comment, changed_at
  FROM demo_tickets d,
       LATERAL (VALUES
         (1, 'NEW', 'Заявку створено', d.created_at),
         (2, 'SCHEDULED', 'Роботу внесено в план на сьогодні', d.scheduled_at),
         (3, 'IN_PROGRESS', 'Адміністратор розпочав роботу', d.started_at),
         (4, 'DONE', 'Виконано за ' || d.actual_minutes || ' хв', d.finished_at),
         (5, 'REJECTED', d.reason, d.rejected_at)
       ) h(step, status, comment, changed_at)
 WHERE h.changed_at IS NOT NULL
 ORDER BY d.no, h.step;

--планові роботи: номінальна дата першої задана явно, далі — від попереднього виконання (як moveRuleDate)
CREATE TEMP TABLE demo_planned ON COMMIT DROP AS
SELECT p.*, r.maintenance_rule_id, r.period_days, r.tolerance_days, sd.day AS done_day,
       (sd.day + p.started_time::time)::timestamptz AS started_at,
       COALESCE(lag(sd.day) OVER (PARTITION BY r.maintenance_rule_id ORDER BY p.occurrence) + r.period_days,
                td.day + p.theta_shift) AS theta
  FROM (VALUES
  (1, 'BACKUP', 1, 44, 0, 44, '09:08', 28),
  (1, 'BACKUP', 2, NULL, NULL, 39, '09:02', 47),
  (1, 'BACKUP', 3, NULL, NULL, 34, '09:01', 28),
  (1, 'BACKUP', 4, NULL, NULL, 29, '09:03', 56),
  (1, 'BACKUP', 5, NULL, NULL, 24, '09:04', 40),
  (1, 'BACKUP', 6, NULL, NULL, 19, '09:03', 70),
  (1, 'BACKUP', 7, NULL, NULL, 14, '09:04', 34),
  (1, 'BACKUP', 8, NULL, NULL, 9, '09:03', 31),
  (1, 'BACKUP', 9, NULL, NULL, 4, '09:05', 29),
  (1, 'OS_UPDATE', 1, 40, 0, 40, '09:03', 69),
  (1, 'OS_UPDATE', 2, NULL, NULL, 19, '10:17', 56),
  (2, 'NETWORK_CHECK', 1, 35, 0, 35, '09:05', 33),
  (3, 'PRINTER_SERVICE', 1, 31, 0, 31, '09:05', 45),
  (4, 'LICENSE_CHECK', 1, 5, 0, 5, '09:53', 17),
  (4, 'OS_UPDATE', 1, 43, 0, 43, '09:01', 28),
  (4, 'OS_UPDATE', 2, NULL, NULL, 22, '09:02', 38),
  (4, 'OS_UPDATE', 3, NULL, NULL, 1, '09:01', 32),
  (4, 'TEMP_FILES', 1, 6, -5, 5, '09:30', 16),
  (4, 'VIRUS_REMOVAL', 1, 41, 0, 41, '09:02', 66),
  (4, 'VIRUS_REMOVAL', 2, NULL, NULL, 20, '09:06', 43),
  (5, 'DUST_CLEANING', 1, 16, 0, 16, '10:06', 58),
  (5, 'OS_UPDATE', 1, 42, 0, 42, '09:08', 36),
  (5, 'OS_UPDATE', 2, NULL, NULL, 21, '09:05', 25),
  (5, 'TEMP_FILES', 1, 37, 0, 37, '09:00', 26),
  (5, 'TEMP_FILES', 2, NULL, NULL, 16, '09:00', 15),
  (5, 'VIRUS_REMOVAL', 1, 39, 0, 39, '10:01', 38),
  (5, 'VIRUS_REMOVAL', 2, NULL, NULL, 18, '09:01', 33),
  (7, 'OS_UPDATE', 1, 36, 0, 36, '09:06', 37),
  (7, 'OS_UPDATE', 2, NULL, NULL, 15, '09:04', 37),
  (7, 'TEMP_FILES', 1, 33, 0, 33, '09:04', 11),
  (7, 'TEMP_FILES', 2, NULL, NULL, 12, '09:07', 11),
  (7, 'VIRUS_REMOVAL', 1, 34, 0, 34, '09:34', 41),
  (7, 'VIRUS_REMOVAL', 2, NULL, NULL, 13, '09:06', 36),
  (8, 'OS_UPDATE', 1, 35, 0, 35, '09:48', 33),
  (8, 'OS_UPDATE', 2, NULL, NULL, 14, '10:33', 25),
  (8, 'TEMP_FILES', 1, 30, 0, 30, '09:00', 15),
  (8, 'TEMP_FILES', 2, NULL, NULL, 9, '10:05', 19),
  (8, 'VIRUS_REMOVAL', 1, 32, 0, 32, '09:03', 28),
  (8, 'VIRUS_REMOVAL', 2, NULL, NULL, 11, '09:05', 29),
  (9, 'OS_UPDATE', 1, 29, 0, 29, '10:05', 34),
  (9, 'OS_UPDATE', 2, NULL, NULL, 8, '09:07', 33),
  (9, 'TEMP_FILES', 1, 25, 0, 25, '09:00', 13),
  (9, 'TEMP_FILES', 2, NULL, NULL, 4, '10:13', 13),
  (9, 'VIRUS_REMOVAL', 1, 28, 0, 28, '09:05', 49),
  (9, 'VIRUS_REMOVAL', 2, NULL, NULL, 7, '10:06', 46),
  (10, 'DUST_CLEANING', 1, 10, 0, 10, '09:03', 29),
  (10, 'OS_UPDATE', 1, 45, 0, 45, '09:02', 32),
  (10, 'OS_UPDATE', 2, NULL, NULL, 24, '09:56', 25),
  (10, 'OS_UPDATE', 3, NULL, NULL, 3, '09:08', 32),
  (10, 'TEMP_FILES', 1, 40, 0, 40, '10:18', 12),
  (10, 'TEMP_FILES', 2, NULL, NULL, 19, '11:16', 13),
  (10, 'VIRUS_REMOVAL', 1, 44, 0, 44, '09:38', 50),
  (10, 'VIRUS_REMOVAL', 2, NULL, NULL, 23, '09:06', 38),
  (10, 'VIRUS_REMOVAL', 3, NULL, NULL, 2, '10:32', 45),
  (11, 'DISK_CHECK', 1, 38, 0, 38, '09:05', 15),
  (12, 'DISK_CHECK', 1, 38, 0, 38, '09:24', 16),
  (15, 'DISK_CHECK', 1, 21, 0, 21, '09:39', 10),
  (16, 'DEFRAG', 1, 24, 0, 24, '10:24', 105),
  (16, 'DISK_CHECK', 1, 24, 0, 24, '12:19', 13),
  (21, 'DISK_CHECK', 1, 6, -7, 5, '09:06', 19)
       ) p(equipment_id, work_type, occurrence, theta_back, theta_shift, started_back, started_time, actual_minutes)
  JOIN maintenance_rules r USING (equipment_id, work_type)
  JOIN demo_days sd ON sd.back = p.started_back
  LEFT JOIN demo_days td ON td.back = p.theta_back;

--вікно θ − δ … θ + δ, як у jobs.js
INSERT INTO tasks (source, maintenance_rule_id, equipment_id, work_type, estimated_minutes, people_count, release_at, due_at,
                   status, started_at, finished_at, actual_minutes)
SELECT 'PLANNED', p.maintenance_rule_id, p.equipment_id, p.work_type, n.seed_minutes, COALESCE(e.affected_people, (
           SELECT GREATEST(1, count(DISTINCT x.user_id))::int FROM (
             SELECT s.assigned_user_id AS user_id FROM equipment s
              WHERE s.tree_path LIKE e.tree_path || '%' AND s.assigned_user_id IS NOT NULL
             UNION
             SELECT c.user_id FROM equipment_consumers c JOIN equipment s USING (equipment_id)
              WHERE s.tree_path LIKE e.tree_path || '%'
           ) x)),
       (p.theta - p.tolerance_days)::timestamptz, (p.theta + p.tolerance_days + 1)::timestamptz,
       'DONE', p.started_at, p.started_at + make_interval(mins => p.actual_minutes), p.actual_minutes
  FROM demo_planned p
  JOIN equipment e USING (equipment_id)
  JOIN service_norms n ON n.equipment_type_id = e.equipment_type_id AND n.work_type = p.work_type
 ORDER BY p.started_at;

--нові заявки сьогодні — для сторінки «Сьогодні»
CREATE TEMP TABLE demo_today ON COMMIT DROP AS
SELECT r.no, r.equipment_id, r.reporter, r.description, s.symptom_id, s.work_type,
       GREATEST(CURRENT_DATE::timestamptz, LEAST(now() - make_interval(mins => 11 * (4 - r.no)), CURRENT_DATE + t.created_time)) AS created_at, NULL::integer AS ticket_id
  FROM (VALUES
         (1, 6, 'Принтер зминає папір', 4, 'Зминає кожен третій аркуш'),
         (2, 9, 'Потрібно встановити програму', 8, 'Потрібен Zoom для зустрічей з клієнтами'),
         (3, 4, 'Пише, що на диску закінчилося місце', 3, NULL)
       ) r(no, equipment_id, symptom, reporter, description)
  CROSS JOIN LATERAL (SELECT (time '08:40' + make_interval(mins => 37 * r.no))::time AS created_time) t
  JOIN equipment e USING (equipment_id)
  JOIN symptoms s ON s.label = r.symptom AND s.equipment_type_id = e.equipment_type_id;

WITH created AS (
  INSERT INTO tickets (reported_by_user_id, equipment_id, symptom_id, description, created_at)
  SELECT reporter, equipment_id, symptom_id, description, created_at FROM demo_today ORDER BY no
  RETURNING ticket_id, equipment_id
)
UPDATE demo_today d SET ticket_id = c.ticket_id FROM created c WHERE c.equipment_id = d.equipment_id;

INSERT INTO ticket_history (ticket_id, status, comment, changed_at)
SELECT ticket_id, 'NEW', 'Заявку створено', created_at FROM demo_today ORDER BY no;

INSERT INTO tasks (source, ticket_id, equipment_id, work_type, estimated_minutes, people_count, release_at)
SELECT 'TICKET', d.ticket_id, d.equipment_id, d.work_type, n.seed_minutes, COALESCE(e.affected_people, (
           SELECT GREATEST(1, count(DISTINCT x.user_id))::int FROM (
             SELECT s.assigned_user_id AS user_id FROM equipment s
              WHERE s.tree_path LIKE e.tree_path || '%' AND s.assigned_user_id IS NOT NULL
             UNION
             SELECT c.user_id FROM equipment_consumers c JOIN equipment s USING (equipment_id)
              WHERE s.tree_path LIKE e.tree_path || '%'
           ) x)), d.created_at
  FROM demo_today d
  JOIN equipment e USING (equipment_id)
  JOIN service_norms n ON n.equipment_type_id = e.equipment_type_id AND n.work_type = d.work_type
 ORDER BY d.no;

--журнал адміністраторів про нові заявки
INSERT INTO notifications (user_id, type, task_id, title, body, created_at)
SELECT a.user_id, 'TICKET_CREATED', t.task_id,
       'Нова заявка: ' || wt.name || ' · ' || e.name || ' (' || e.inventory_number || ')',
       concat_ws(' · ', s.label || COALESCE(' — «' || d.description || '»', ''), 'заявка №' || d.ticket_id || ' від ' || u.full_name),
       d.created_at
  FROM demo_today d
  JOIN tasks t ON t.ticket_id = d.ticket_id
  JOIN equipment e ON e.equipment_id = d.equipment_id
  JOIN work_types wt ON wt.work_type = d.work_type
  JOIN symptoms s ON s.symptom_id = d.symptom_id
  JOIN users u ON u.user_id = d.reporter
  JOIN users a ON a.role = 'IT_ADMIN' AND a.is_active
 ORDER BY d.no, a.user_id;

--медіана фактичного часу, як refreshNormMedian
UPDATE service_norms n
   SET observed_median_minutes = GREATEST(1, round(o.median)::int), sample_count = o.samples
  FROM (SELECT e.equipment_type_id, t.work_type,
               percentile_cont(0.5) WITHIN GROUP (ORDER BY t.actual_minutes) AS median, count(*) AS samples
          FROM tasks t JOIN equipment e USING (equipment_id)
         WHERE t.status = 'DONE' AND t.actual_minutes > 0
         GROUP BY e.equipment_type_id, t.work_type) o
 WHERE n.equipment_type_id = o.equipment_type_id AND n.work_type = o.work_type;

--наступна дата від останнього виконання, як moveRuleDate
UPDATE maintenance_rules r
   SET next_due_date = last.done_day + r.period_days
  FROM (SELECT maintenance_rule_id, max(finished_at)::date AS done_day
          FROM tasks WHERE source = 'PLANNED' AND status = 'DONE'
         GROUP BY maintenance_rule_id) last
 WHERE last.maintenance_rule_id = r.maintenance_rule_id;
