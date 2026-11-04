# ER-діаграма бази даних

Схема — міграції `001_schema.sql` і `003_work_types_and_fk.sql`: 15 таблиць, лише ключі,
обмеження й індекси. Тригерів і збережених функцій немає: шлях у дереві обладнання, кількість
людей, норматив тривалості й медіану нормативів рахує код сервера.

## Уся схема

```mermaid
erDiagram
    users ||--o{ equipment : "закріплено за"
    users ||--o{ equipment_consumers : "користується"
    users ||--o{ tickets : "подає"
    users ||--o{ notifications : "отримує"
    equipment_types ||--o{ equipment : "тип"
    equipment_types ||--o{ symptoms : "симптоми типу"
    equipment_types ||--o{ service_norms : "нормативи"
    equipment ||--o{ equipment : "входить до складу"
    equipment ||--o{ equipment_consumers : ""
    equipment ||--o{ maintenance_rules : "регламенти"
    equipment ||--o{ tickets : "несправність"
    equipment ||--o{ tasks : "робота на"
    symptoms ||--o{ tickets : "що сталося"
    tickets ||--o{ ticket_history : "історія статусів"
    tickets ||--o| tasks : "робота заявки"
    maintenance_rules ||--o{ tasks : "планова робота"
    tasks ||--o| plan_items : "позиція плану"
    tasks |o--o{ notifications : "сповіщення про роботу"
    work_types ||--o{ symptoms : "вид робіт"
    work_types ||--o{ service_norms : "вид робіт"
    work_types ||--o{ maintenance_rules : "вид робіт"
    work_types ||--o{ tasks : "вид робіт"

    users {
        int user_id PK
        text email
        text password_hash
        text full_name
        text role
        bool is_active
    }
    equipment_types {
        int equipment_type_id PK
        text code
        text name
        text category
    }
    equipment {
        int equipment_id PK
        text inventory_number
        text name
        int equipment_type_id FK
        int parent_equipment_id FK
        int assigned_user_id FK
        text tree_path
        int affected_people
    }
    equipment_consumers {
        int equipment_id PK
        int user_id PK
    }
    work_types {
        text work_type PK
        text name
    }
    symptoms {
        int symptom_id PK
        text label
        int equipment_type_id FK
        text work_type FK
    }
    service_norms {
        int service_norm_id PK
        int equipment_type_id FK
        text work_type FK
        int seed_minutes
        int observed_median_minutes
        int sample_count
    }
    maintenance_rules {
        int maintenance_rule_id PK
        int equipment_id FK
        text work_type FK
        int period_days
        int tolerance_days
        date next_due_date
    }
    work_hours {
        int day_of_week PK
        time start_time
        time end_time
        time break_start
        time break_end
    }
    settings {
        text setting_key PK
        text setting_value
    }
    tickets {
        int ticket_id PK
        int reported_by_user_id FK
        int equipment_id FK
        int symptom_id FK
        text description
        text status
        text reject_reason
    }
    ticket_history {
        int ticket_history_id PK
        int ticket_id FK
        text status
        text comment
        timestamptz changed_at
    }
    tasks {
        int task_id PK
        text source
        int ticket_id FK
        int maintenance_rule_id FK
        int equipment_id FK
        text work_type FK
        int estimated_minutes
        int people_count
        timestamptz release_at
        timestamptz due_at
        text status
        timestamptz started_at
        timestamptz finished_at
        int actual_minutes
    }
    plan_items {
        int task_id PK
        int position
        timestamptz planned_start_at
        timestamptz planned_end_at
        int group_root_equipment_id FK
    }
    notifications {
        int notification_id PK
        int user_id FK
        text type
        int task_id FK
        text title
        bool is_read
    }
```

## Позначення задачі планування в таблиці `tasks`

| Символ | Сенс | Колонка |
|---|---|---|
| r | момент надходження (для планової роботи — початок вікна) | `release_at` |
| d | кінець вікна планової роботи | `due_at` |
| p | тривалість за нормативом | `estimated_minutes` |
| n | кількість людей, яких зачіпає робота | `people_count` |
| C | момент завершення | `finished_at` (факт), `plan_items.planned_end_at` (план) |

## Значення текстових колонок

| Колонка | Значення |
|---|---|
| `users.role` | `EMPLOYEE`, `IT_ADMIN` |
| `*.work_type` | зовнішній ключ на довідник `work_types`; у демо-даних `DIAGNOSTICS`, `REPAIR`, `REPLACEMENT`, `MAINTENANCE`, `CLEANING`, `SOFTWARE`, адміністратор може додати інші |
| `tickets.status` | `NEW`, `SCHEDULED`, `IN_PROGRESS`, `DONE`, `REJECTED` |
| `tasks.source` | `TICKET`, `PLANNED` |
| `tasks.status` | `NEW`, `SCHEDULED`, `IN_PROGRESS`, `DONE`, `CANCELLED` |
| `notifications.type` | `TICKET`, `MAINTENANCE_PLANNED`, `MAINTENANCE_SOON` |
| `settings.setting_key` | `ALGORITHM`, `NORM_MIN_SAMPLES`, `PLAN_HORIZON_DAYS`, `REMINDER_DAYS` |
