import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from './api';
import { RECOMMENDED_RULE, RULES, STATUSES } from './labels';
import type { Equipment, Rule } from './types';

export function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    api<T>('GET', path)
      .then((result) => {
        setData(result);
        setError('');
      })
      .catch((err: Error) => setError(err.message));
  }, [path]);

  useEffect(reload, [reload]);

  return { data, error, reload, setData };
}

export function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

export function formatTime(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : '—';
}

export function Page({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <main className="page">
      <h2 className="page-title">{title}</h2>
      <p className="page-subtitle">{hint}</p>
      {children}
    </main>
  );
}

export function ErrorText({ text }: { text: string }) {
  return text ? <p className="error">{text}</p> : null;
}

const TONES: Record<string, string> = {
  NEW: 'blue',
  SCHEDULED: 'grey',
  IN_PROGRESS: 'yellow',
  DONE: 'green',
  REJECTED: 'red',
  CANCELLED: 'red',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status status-${TONES[status] ?? 'grey'}`}>{STATUSES[status] ?? status}</span>;
}

export function RuleName({ rule }: { rule: Rule }) {
  return (
    <span className="rule">
      <span className="rule-name">
        {RULES[rule].name}
        {rule === RECOMMENDED_RULE && <span className="pill">рекомендовано</span>}
      </span>
      <span className="rule-description">{RULES[rule].description}</span>
    </span>
  );
}

export function EquipmentTree({
  items,
  selectedId,
  onSelect,
}: {
  items: Equipment[];
  selectedId?: number | null;
  onSelect?: (item: Equipment) => void;
}) {
  if (items.length === 0) return <p className="empty">Обладнання немає.</p>;

  return (
    <ul className="tree">
      {items.map((item) => (
        <li
          key={item.equipment_id}
          className={`tree-row${item.equipment_id === selectedId ? ' tree-row-selected' : ''}`}
          style={{ paddingLeft: (item.tree_path.split('.').length - 3) * 24 + 8 }}
          onClick={onSelect ? () => onSelect(item) : undefined}
        >
          <span className="tree-name">{item.name}</span>
          <span className="sticker">{item.inventory_number}</span>
          <span className="tree-extra">{item.type_name}</span>
        </li>
      ))}
    </ul>
  );
}
