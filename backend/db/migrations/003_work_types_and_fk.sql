--довідник видів робіт
CREATE TABLE work_types (
    work_type text NOT NULL,
    name      text NOT NULL,
    CONSTRAINT pk_work_types PRIMARY KEY (work_type)
);

--код, якого тут немає, зупинить міграцію на зовнішньому ключі нижче
INSERT INTO work_types (work_type, name) VALUES
  ('DIAGNOSTICS', 'Діагностика несправності'),
  ('REPAIR', 'Ремонт'),
  ('REPLACEMENT', 'Заміна комплектуючих (диск, блок живлення, оперативна пам''ять)'),
  ('DUST_CLEANING', 'Очищення системного блока від пилу, заміна термопасти'),
  ('VIRUS_REMOVAL', 'Перевірка на віруси та їх видалення'),
  ('SOFTWARE_INSTALL', 'Встановлення та налаштування програм'),
  ('OS_UPDATE', 'Встановлення оновлень Windows'),
  ('LICENSE_CHECK', 'Перевірка ліцензійності встановлених програм'),
  ('DEFRAG', 'Дефрагментація жорсткого диска (лише HDD)'),
  ('DISK_CHECK', 'Перевірка стану диска (S.M.A.R.T.)'),
  ('TEMP_FILES', 'Видалення тимчасових файлів і перевірка вільного місця на диску'),
  ('BACKUP', 'Резервне копіювання даних сервера та перевірка копій'),
  ('PRINTER_SERVICE', 'Профілактика принтера (видалення тонерного пилу, перевірка роликів подачі паперу)'),
  ('NETWORK_CHECK', 'Перевірка комутатора та оновлення прошивки');

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
