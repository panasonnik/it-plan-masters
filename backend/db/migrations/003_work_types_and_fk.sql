--довідник видів робіт
CREATE TABLE work_types (
    work_type text NOT NULL,
    name      text NOT NULL,
    CONSTRAINT pk_work_types PRIMARY KEY (work_type)
);

--види робіт з наявних даних
INSERT INTO work_types (work_type, name)
SELECT DISTINCT used.work_type,
       CASE used.work_type
           WHEN 'DIAGNOSTICS' THEN 'Діагностика'
           WHEN 'REPAIR' THEN 'Ремонт'
           WHEN 'REPLACEMENT' THEN 'Заміна'
           WHEN 'MAINTENANCE' THEN 'Технічне обслуговування'
           WHEN 'CLEANING' THEN 'Чищення'
           WHEN 'SOFTWARE' THEN 'Програмне забезпечення'
           ELSE used.work_type
       END
  FROM (SELECT work_type FROM symptoms
        UNION ALL SELECT work_type FROM service_norms
        UNION ALL SELECT work_type FROM maintenance_rules
        UNION ALL SELECT work_type FROM tasks) used;

ALTER TABLE symptoms
    ADD CONSTRAINT fk_symptoms_work_type FOREIGN KEY (work_type) REFERENCES work_types (work_type) ON UPDATE CASCADE;
ALTER TABLE service_norms
    ADD CONSTRAINT fk_service_norms_work_type FOREIGN KEY (work_type) REFERENCES work_types (work_type) ON UPDATE CASCADE;
ALTER TABLE maintenance_rules
    ADD CONSTRAINT fk_maintenance_rules_work_type FOREIGN KEY (work_type) REFERENCES work_types (work_type) ON UPDATE CASCADE;
ALTER TABLE tasks
    ADD CONSTRAINT fk_tasks_work_type FOREIGN KEY (work_type) REFERENCES work_types (work_type) ON UPDATE CASCADE;

--прибрати посилання на видалені роботи
UPDATE notifications n
   SET task_id = NULL
 WHERE n.task_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.task_id = n.task_id);

ALTER TABLE notifications
    ADD CONSTRAINT fk_notifications_task FOREIGN KEY (task_id) REFERENCES tasks (task_id) ON DELETE SET NULL;
