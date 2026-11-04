CREATE TABLE users (
    user_id       serial      NOT NULL,
    email         text        NOT NULL,
    password_hash text        NOT NULL,
    full_name     text        NOT NULL,
    role          text        NOT NULL DEFAULT 'EMPLOYEE',
    is_active     boolean     NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_users PRIMARY KEY (user_id),
    CONSTRAINT ck_users_role CHECK (role IN ('EMPLOYEE', 'IT_ADMIN'))
);

CREATE UNIQUE INDEX uq_users_email ON users (lower(email));

CREATE TABLE equipment_types (
    equipment_type_id serial NOT NULL,
    code              text   NOT NULL,
    name              text   NOT NULL,
    category          text   NOT NULL,
    CONSTRAINT pk_equipment_types PRIMARY KEY (equipment_type_id),
    CONSTRAINT uq_equipment_types_code UNIQUE (code)
);

--шлях у дереві, наприклад .3.14.
--null — кількість людей рахує система
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

CREATE INDEX ix_equipment_path ON equipment (tree_path text_pattern_ops);
CREATE INDEX ix_equipment_assigned_user ON equipment (assigned_user_id);

CREATE TABLE equipment_consumers (
    equipment_id integer NOT NULL,
    user_id      integer NOT NULL,
    CONSTRAINT pk_equipment_consumers PRIMARY KEY (equipment_id, user_id),
    CONSTRAINT fk_equipment_consumers_equipment FOREIGN KEY (equipment_id) REFERENCES equipment (equipment_id) ON DELETE CASCADE,
    CONSTRAINT fk_equipment_consumers_user FOREIGN KEY (user_id) REFERENCES users (user_id)
);

CREATE TABLE symptoms (
    symptom_id        serial  NOT NULL,
    label             text    NOT NULL,
    equipment_type_id integer,
    work_type         text    NOT NULL,
    CONSTRAINT pk_symptoms PRIMARY KEY (symptom_id),
    CONSTRAINT fk_symptoms_equipment_type FOREIGN KEY (equipment_type_id) REFERENCES equipment_types (equipment_type_id)
);

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

--1 — понеділок, 7 — неділя
CREATE TABLE work_hours (
    day_of_week integer NOT NULL,
    start_time  time    NOT NULL,
    end_time    time    NOT NULL,
    break_start time,
    break_end   time,
    CONSTRAINT pk_work_hours PRIMARY KEY (day_of_week),
    CONSTRAINT ck_work_hours_day CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT ck_work_hours_range CHECK (end_time > start_time)
);

CREATE TABLE settings (
    setting_key   text NOT NULL,
    setting_value text NOT NULL,
    description   text,
    CONSTRAINT pk_settings PRIMARY KEY (setting_key)
);

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

CREATE INDEX ix_tickets_reported_by ON tickets (reported_by_user_id);

CREATE TABLE ticket_history (
    ticket_history_id serial      NOT NULL,
    ticket_id         integer     NOT NULL,
    status            text        NOT NULL,
    comment           text,
    changed_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_ticket_history PRIMARY KEY (ticket_history_id),
    CONSTRAINT fk_ticket_history_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (ticket_id)
);

CREATE INDEX ix_ticket_history_ticket ON ticket_history (ticket_id);

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

--одна відкрита заявка одного виду
CREATE UNIQUE INDEX uq_tasks_open_ticket ON tasks (equipment_id, work_type)
    WHERE source = 'TICKET' AND status IN ('NEW', 'SCHEDULED', 'IN_PROGRESS');
CREATE UNIQUE INDEX uq_tasks_open_planned ON tasks (equipment_id, work_type)
    WHERE source = 'PLANNED' AND status IN ('NEW', 'SCHEDULED', 'IN_PROGRESS');

--виконується лише одна робота
CREATE UNIQUE INDEX uq_tasks_one_in_progress ON tasks (status) WHERE status = 'IN_PROGRESS';

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

CREATE TABLE notifications (
    notification_id serial      NOT NULL,
    user_id         integer     NOT NULL,
    type            text        NOT NULL,
    task_id         integer,
    title           text        NOT NULL,
    body            text,
    is_read         boolean     NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_notifications PRIMARY KEY (notification_id),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (user_id)
);

CREATE INDEX ix_notifications_user ON notifications (user_id, created_at DESC);
