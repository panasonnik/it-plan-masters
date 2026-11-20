import { useState } from 'react';
import { api } from '../api';
import { ErrorText, Page, useLoad } from '../ui';
import type { Equipment, Row } from '../types';
import UsersTab from './UsersTab';
import WorkHoursTab from './WorkHoursTab';
import SettingsTab from './SettingsTab';

interface Column {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'readonly';
  options?: [string | number, string][];
  //що показати замість порожнього значення
  emptyLabel?: string;
  sortable?: boolean;
}

interface Sort {
  key: string;
  descending: boolean;
}

interface TableConfig {
  name: string;
  key: string;
  columns: Column[];
  canAdd: boolean;
  //лише перегляд і додавання
  addOnly?: boolean;
  defaultSort?: string;
  intro?: string;
  addLabel?: string;
}

export default function ReferencesPage() {
  const [tab, setTab] = useState('symptoms');
  const types = useLoad<Row[]>('/references/equipment-types');
  const equipment = useLoad<Equipment[]>('/equipment');
  const workTypes = useLoad<Row[]>('/references/work-types');

  const typeOptions = (types.data ?? []).map((t): [number, string] => [t.equipment_type_id as number, t.name as string]);
  const workTypeOptions = (workTypes.data ?? []).map((w): [string, string] => [w.work_type as string, w.name as string]);
  const equipmentOptions = (equipment.data ?? []).map((e): [number, string] => [e.equipment_id, `${e.name} (${e.inventory_number})`]);

  const tables: Record<string, TableConfig> = {
    symptoms: {
      name: 'symptoms',
      key: 'symptom_id',
      canAdd: true,
      defaultSort: 'equipment_type_id',
      columns: [
        {
          key: 'equipment_type_id',
          label: 'Обладнання',
          type: 'select',
          options: typeOptions,
          emptyLabel: 'Усі типи',
          sortable: true,
        },
        { key: 'label', label: 'Що сталося', type: 'text', sortable: true },
        { key: 'work_type', label: 'Вид робіт', type: 'select', options: workTypeOptions, sortable: true },
      ],
    },
    norms: {
      name: 'norms',
      key: 'service_norm_id',
      canAdd: true,
      columns: [
        { key: 'equipment_type_id', label: 'Тип обладнання', type: 'select', options: typeOptions },
        { key: 'work_type', label: 'Вид робіт', type: 'select', options: workTypeOptions },
        { key: 'seed_minutes', label: 'Початкова оцінка, хв', type: 'number' },
        { key: 'observed_median_minutes', label: 'Медіана фактичного часу, хв', type: 'readonly' },
        { key: 'sample_count', label: 'Виконано робіт', type: 'readonly' },
      ],
    },
    rules: {
      name: 'rules',
      key: 'maintenance_rule_id',
      canAdd: true,
      columns: [
        { key: 'equipment_id', label: 'Обладнання', type: 'select', options: equipmentOptions },
        { key: 'work_type', label: 'Що зробити', type: 'select', options: workTypeOptions },
        { key: 'period_days', label: 'Повторювати кожні, днів', type: 'number' },
        { key: 'tolerance_days', label: 'Можна виконати раніше або пізніше, на ± днів', type: 'number' },
        { key: 'next_due_date', label: 'Наступного разу', type: 'date' },
      ],
      intro: 'Як часто повторювати планові роботи. Після виконання наступна дата зсувається на вказану кількість днів.',
      addLabel: '+ Додати планову роботу',
    },
    departments: {
      name: 'departments',
      key: 'department_id',
      canAdd: true,
      columns: [{ key: 'name', label: 'Назва підрозділу', type: 'text' }],
      intro: 'Підрозділ задають кореневому обладнанню на сторінці «Обладнання». Він потрібен лише для відображення дерева.',
      addLabel: '+ Додати підрозділ',
    },
    workTypes: {
      name: 'work-types',
      key: 'work_type',
      canAdd: true,
      addOnly: true,
      columns: [
        { key: 'work_type', label: 'Код', type: 'text' },
        { key: 'name', label: 'Назва', type: 'text' },
      ],
    },
  };

  const tabs: [string, string][] = [
    ['symptoms', 'Симптоми'],
    ['norms', 'Нормативи'],
    ['rules', 'Графік планових робіт'],
    ['departments', 'Підрозділи'],
    ['workTypes', 'Види робіт'],
    ['hours', 'Робочий час'],
    ['users', 'Користувачі'],
    ['settings', 'Налаштування'],
  ];

  return (
    <Page title="Довідники" hint="Дані, з яких система обчислює вид робіт, тривалість і план.">
      <nav className="tabs">
        {tabs.map(([code, label]) => (
          <button key={code} type="button" className={`tab${tab === code ? ' tab-active' : ''}`} onClick={() => setTab(code)}>
            {label}
          </button>
        ))}
      </nav>
      {tab === 'hours' && <WorkHoursTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'settings' && <SettingsTab />}
      {tables[tab] && <ReferenceTable key={tab} config={tables[tab]} onSaved={workTypes.reload} />}
    </Page>
  );
}

function ReferenceTable({ config, onSaved }: { config: TableConfig; onSaved: () => void }) {
  const { data, error, reload } = useLoad<Row[]>(`/references/${config.name}`);
  const [editing, setEditing] = useState<Row | null>(null);
  const [actionError, setActionError] = useState('');
  const [editError, setEditError] = useState('');
  const [sort, setSort] = useState<Sort | null>(config.defaultSort ? { key: config.defaultSort, descending: false } : null);

  const editable = config.columns.filter((column) => column.type !== 'readonly');
  const [isNew, setIsNew] = useState(false);

  function edit(row: Row | null, fresh = false) {
    setEditing(row);
    setIsNew(fresh);
    setEditError('');
  }

  async function save() {
    const body = Object.fromEntries(editable.map((column) => [column.key, editing![column.key] === '' ? null : editing![column.key]]));
    try {
      if (isNew) await api('POST', `/references/${config.name}`, body);
      else await api('PUT', `/references/${config.name}/${editing![config.key]}`, body);
      edit(null);
      reload();
      onSaved();
    } catch (err) {
      setEditError((err as Error).message);
    }
  }

  async function remove(row: Row) {
    try {
      await api('DELETE', `/references/${config.name}/${row[config.key]}`);
      setActionError('');
      reload();
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  function show(column: Column, row: Row) {
    const value = row[column.key];
    if (column.type === 'date' && value) return String(value).slice(0, 10);
    return column.options?.find(([code]) => String(code) === String(value))?.[1] ?? value ?? column.emptyLabel ?? '—';
  }

  function toggleSort(key: string) {
    setSort(sort?.key === key ? { key, descending: !sort.descending } : { key, descending: false });
  }

  //порожні значення — на початку; рівні зберігають порядок із сервера
  function sorted(rows: Row[]): Row[] {
    const column = config.columns.find((c) => c.key === sort?.key);
    if (!sort || !column) return rows;

    const valueOf = (row: Row) => (row[column.key] === null || row[column.key] === '' ? null : String(show(column, row)));
    return [...rows].sort((a, b) => {
      const [left, right] = [valueOf(a), valueOf(b)];
      const order = left === right ? 0 : left === null ? -1 : right === null ? 1 : left.localeCompare(right, 'uk', { numeric: true });
      return sort.descending ? -order : order;
    });
  }

  function input(column: Column) {
    const value = String(editing![column.key] ?? '').slice(0, column.type === 'date' ? 10 : undefined);
    const change = (text: string) => setEditing({ ...editing!, [column.key]: text });
    if (column.type === 'readonly') return show(column, editing!);
    if (column.type !== 'select') return <input type={column.type} value={value} onChange={(e) => change(e.target.value)} />;

    return (
      <select value={value} onChange={(e) => change(e.target.value)}>
        <option value="">{column.emptyLabel ?? '—'}</option>
        {column.options?.map(([code, label]) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
    );
  }

  const rows = isNew ? [...sorted(data ?? []), editing!] : sorted(data ?? []);

  return (
    <>
      {config.intro && <p className="muted">{config.intro}</p>}
      <ErrorText text={error || actionError} />
      <table>
        <thead>
          <tr>
            {config.columns.map((column) => {
              const active = sort?.key === column.key;
              return (
                <th key={column.key} aria-sort={active ? (sort.descending ? 'descending' : 'ascending') : undefined}>
                  {column.sortable ? (
                    <button
                      type="button"
                      className={`sort-button${active ? ' sort-active' : ''}`}
                      title="Сортувати"
                      onClick={() => toggleSort(column.key)}
                    >
                      {column.label} {active ? (sort.descending ? '▼' : '▲') : '↕'}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const isEdited = editing !== null && (row === editing || (!isNew && row[config.key] === editing[config.key]));
            return (
              <tr key={String(row[config.key] ?? `new-${index}`)}>
                {config.columns.map((column) => (
                  <td key={column.key}>{isEdited ? input(column) : show(column, row)}</td>
                ))}
                <td className="actions">
                  {isEdited ? (
                    <>
                      <button type="button" className="button button-primary" onClick={save}>
                        Зберегти
                      </button>
                      <button type="button" className="link-button" onClick={() => edit(null)}>
                        Скасувати
                      </button>
                      <ErrorText text={editError} />
                    </>
                  ) : (
                    !config.addOnly && (
                      <>
                        <button type="button" className="link-button" onClick={() => edit(row)}>
                          змінити
                        </button>
                        {config.canAdd && (
                          <button type="button" className="link-button" onClick={() => remove(row)}>
                            видалити
                          </button>
                        )}
                      </>
                    )
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {config.canAdd && !isNew && (
        <button type="button" className="button" onClick={() => edit({}, true)}>
          {config.addLabel ?? '+ Додати'}
        </button>
      )}
    </>
  );
}
