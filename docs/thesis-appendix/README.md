# Матеріали для додатків записки

Схема — з міграцій `backend/db/migrations` (001–003), фрагменти коду скопійовано з файлів
репозиторію гілки simplify-3.

| Файл | Що в ньому |
|---|---|
| [01-er-diagram.md](01-er-diagram.md) | ER-діаграма схеми (Mermaid `erDiagram`), позначення r, d, p, n, C у таблиці `tasks`, значення текстових колонок |
| [02-migrations.md](02-migrations.md) | три міграції з описом |
| [03-sql-fragments.md](03-sql-fragments.md) | `CREATE TABLE` основних таблиць, часткові унікальні індекси, запити шляху в дереві, кількості людей, нормативу, медіани і робочих змін |
| [04-demo-data.md](04-demo-data.md) | демо-дані бази (32 нормативи, 28 симптомів, 26 одиниць обладнання) і параметри каталогу організації для експерименту |
| [05-code-fragments.md](05-code-fragments.md) | чотири правила, `nextStep`, `addWorkingMinutes`, цикл симулятора, моменти надходження, N та інтервал, живий план |
| [06-planning-flowchart.md](06-planning-flowchart.md) | блок-схема визначення групи роботи (Mermaid `flowchart`) |
| [07-versions.md](07-versions.md) | точні версії PostgreSQL, Node.js, бібліотек |
| [08-endpoints.md](08-endpoints.md) | усі ендпойнти API з ролями |
| [images/](images/) | блок-схема визначення групи в PNG для Word |

Діаграми для аркушів і рисунків розділу 5 (зокрема блок-схема плану, рисунок 5.4) — у
[`docs/thesis-diagrams`](../thesis-diagrams/README.md). Таблиці результатів експерименту —
`backend/results/thesis/tables.md`, графіки — `backend/results/thesis/z-mean.png` і `convergence.png`.
