# Ендпойнти API

Усі шляхи — з префіксом `/api`. «Будь-хто» — без входу; «Користувач» — будь-хто, хто
увійшов; «Адміністратор» — роль `IT_ADMIN`. Помилка завжди має вигляд
`{ "error": "текст для людини" }`.

| Метод і шлях | Хто | Що робить | Файл маршруту |
|---|---|---|---|
| `POST /auth/register` | Будь-хто | реєстрація працівника, повертає токен | `modules/auth/auth.routes.js` |
| `POST /auth/login` | Будь-хто | вхід, повертає токен на 8 годин | `modules/auth/auth.routes.js` |
| `GET /auth/me` | Користувач | хто увійшов | `modules/auth/auth.routes.js` |
| `GET /users` | Адміністратор | список користувачів | `modules/users/users.routes.js` |
| `POST /users` | Адміністратор | новий обліковий запис з роллю | `modules/users/users.routes.js` |
| `PATCH /users/:id` | Адміністратор | ім'я, роль, вимкнути / увімкнути | `modules/users/users.routes.js` |
| `GET /equipment/my` | Користувач | своє обладнання з усім, що під ним | `modules/equipment/equipment.routes.js` |
| `GET /equipment` | Адміністратор | усе обладнання деревом, з кількістю людей і споживачами | `modules/equipment/equipment.routes.js` |
| `POST /equipment` | Адміністратор | нове обладнання | `modules/equipment/equipment.routes.js` |
| `PATCH /equipment/:id` | Адміністратор | змінити, перенести в дереві, закріпити, задати кількість людей | `modules/equipment/equipment.routes.js` |
| `DELETE /equipment/:id` | Адміністратор | видалити вузол без дочірніх | `modules/equipment/equipment.routes.js` |
| `POST /equipment/:id/consumers` | Адміністратор | додати споживача | `modules/equipment/equipment.routes.js` |
| `DELETE /equipment/:id/consumers/:userId` | Адміністратор | прибрати споживача | `modules/equipment/equipment.routes.js` |
| `GET /references/symptoms-for/:equipmentId` | Користувач | симптоми, які можна обрати для пристрою | `modules/references/references.routes.js` |
| `GET /references/equipment-types` | Користувач | типи обладнання | `modules/references/references.routes.js` |
| `GET, POST /references/work-types` | Адміністратор | види робіт: список і додавання | `modules/references/references.routes.js` |
| `GET, PUT /references/work-hours` | Адміністратор | робочий час на тиждень | `modules/references/references.routes.js` |
| `GET /references/settings`, `PUT /references/settings/:key` | Адміністратор | числові налаштування | `modules/references/references.routes.js` |
| `GET, POST /references/:name`, `PUT, DELETE /references/:name/:id` | Адміністратор | довідники `symptoms`, `norms`, `rules` | `modules/references/references.routes.js` |
| `POST /tickets` | Користувач | заявка: пристрій, симптом, опис | `modules/tickets/tickets.routes.js` |
| `GET /tickets/my` | Користувач | свої заявки з історією статусів | `modules/tickets/tickets.routes.js` |
| `GET /tickets` | Адміністратор | усі заявки | `modules/tickets/tickets.routes.js` |
| `POST /tickets/:id/reject` | Адміністратор | відхилити до початку роботи | `modules/tickets/tickets.routes.js` |
| `GET /plan` | Адміністратор | «Сьогодні»: зараз, далі, чекають, виконано | `modules/plan/plan.routes.js` |
| `POST /plan` | Адміністратор | скласти план на сьогодні зараз | `modules/plan/plan.routes.js` |
| `PUT /plan/rule` | Адміністратор | обрати правило черговості | `modules/plan/plan.routes.js` |
| `PATCH /tasks/:id` | Адміністратор | виправити вид робіт і кількість людей до початку | `modules/tasks/tasks.routes.js` |
| `POST /tasks/:id/start` | Адміністратор | почати роботу | `modules/tasks/tasks.routes.js` |
| `POST /tasks/:id/complete` | Адміністратор | завершити з фактичним часом | `modules/tasks/tasks.routes.js` |
| `GET /notifications` | Користувач | свої сповіщення | `modules/notifications/notifications.routes.js` |
| `POST /notifications/:id/read` | Користувач | позначити своє сповіщення прочитаним | `modules/notifications/notifications.routes.js` |
| `GET /reports/downtime?from&to` | Адміністратор | втрати Z і простій S за період | `modules/reports/reports.routes.js` |
