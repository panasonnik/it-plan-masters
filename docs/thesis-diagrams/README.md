# Діаграми для записки

Перемальовано 03.11.2026 за кодом гілки simplify-3; версії з master були лише основою. Звірено ще раз 04.11.2026 після міграції 003 (довідник work_types, FK notifications.task_id) і кнопки «Подати заявку» в адміністратора.

| Файл | Що це | Куди в записці |
|---|---|---|
| `01-structure.mmd` | структурна схема: браузер, сервер, база даних, підсистема експерименту | аркуш 1 |
| `02-use-cases.puml` | варіанти використання ВВ-1…ВВ-11 | аркуш 2 |
| `03-activity.puml` | діяльність від заявки до «Готово» і перерахунку нормативу в `completeTask()` | аркуш 3 |
| `04-states.mmd` | стани заявки (`tickets.status`) і роботи (`tasks.status`) | аркуш 4 |
| `05-er.mmd` | ER-діаграма: 15 таблиць з міграцій 001–003 і `migrations` | аркуш 5 |
| `06-components.mmd` | компоненти серверної частини | аркуш 6 |
| `07-sequence-create-ticket.mmd` | послідовність `POST /api/tickets` | аркуш 7 |
| `08a-buildSchedule.mmd` | основний алгоритм `buildSchedule()` | рисунок 5.4, а |
| `08b-nextStep.mmd` | підпрограма `nextStep()` | рисунок 5.4, б |
| `08-planning-flowchart-v2.png` | обидві частини поруч з підписами «а)» і «б)»; 5664 px завширшки, годиться й для аркуша A1 | рисунок 5.4, аркуш 8 |
| `09-request-layers.mmd` | шлях запиту через шари модуля з обробником помилок | у тексті |
| `10-experiment-dataflow.mmd` | потоки даних підсистеми експерименту | у тексті |
| `mermaid-config.json` | спільне оформлення Mermaid: Arial 24 px, нейтральна тема | |

Кожна діаграма має `.png` (Mermaid `-s 2`, PlantUML 192 dpi, білий фон) і `.svg`.

## Як перерендерити

З цієї папки (Git Bash). Перший запуск `npx` завантажує mermaid-cli і Chromium у кеш npm;
`plantuml.jar` — з https://github.com/plantuml/plantuml/releases (потрібні Java і Graphviz).

```
for b in 01-structure 04-states 05-er 06-components 07-sequence-create-ticket 09-request-layers 10-experiment-dataflow; do
  npx -y @mermaid-js/mermaid-cli@11.4.2 -i $b.mmd -o $b.svg -c mermaid-config.json -b white
  npx -y @mermaid-js/mermaid-cli@11.4.2 -i $b.mmd -o $b.png -c mermaid-config.json -b white -s 2 -w 4500
done
for b in 08a-buildSchedule 08b-nextStep; do
  npx -y @mermaid-js/mermaid-cli@11.4.2 -i $b.mmd -o $b.svg -c mermaid-config.json -b white
  npx -y @mermaid-js/mermaid-cli@11.4.2 -i $b.mmd -o $b.png -c mermaid-config.json -b white -s 2 -w 3000
done
for p in 02-use-cases 03-activity; do
  java -DPLANTUML_LIMIT_SIZE=16384 -jar plantuml.jar -charset UTF-8 -tsvg $p.puml
  java -DPLANTUML_LIMIT_SIZE=16384 -jar plantuml.jar -charset UTF-8 -Sdpi=192 -tpng $p.puml
done
```

`-w 3000` потрібен, щоб обидві частини мали однаковий масштаб шрифту: без нього
mermaid-cli вписує діаграму в 800 px, і вища частина виходить дрібнішою.
