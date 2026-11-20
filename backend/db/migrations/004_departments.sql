--підрозділ лише для відображення; планування і звіт його не враховують
CREATE TABLE departments (
    department_id serial NOT NULL,
    name          text   NOT NULL,
    CONSTRAINT pk_departments PRIMARY KEY (department_id),
    CONSTRAINT uq_departments_name UNIQUE (name)
);

--задається лише кореневому обладнанню; дочірнє показується під батьком
ALTER TABLE equipment ADD COLUMN department_id integer;
ALTER TABLE equipment
    ADD CONSTRAINT fk_equipment_department FOREIGN KEY (department_id) REFERENCES departments (department_id);

CREATE INDEX ix_equipment_department ON equipment (department_id);

INSERT INTO departments (name) VALUES
  ('Бухгалтерія'),
  ('Відділ продажів'),
  ('Адміністрація'),
  ('Спільне обладнання');

UPDATE equipment e
   SET department_id = d.department_id
  FROM departments d
 WHERE e.parent_equipment_id IS NULL
   AND d.name = CASE e.inventory_number
                    WHEN '10400004' THEN 'Бухгалтерія'
                    WHEN '10400005' THEN 'Бухгалтерія'
                    WHEN '10400006' THEN 'Бухгалтерія'
                    WHEN '10400007' THEN 'Відділ продажів'
                    WHEN '10400008' THEN 'Відділ продажів'
                    WHEN '10400009' THEN 'Відділ продажів'
                    WHEN '10400010' THEN 'Адміністрація'
                    ELSE 'Спільне обладнання'
                END;
