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

interface TreeNode {
  item: Equipment;
  children: TreeNode[];
}

interface TreeGroup {
  key: string;
  name: string;
  nodes: TreeNode[];
  count: number;
}

const NO_DEPARTMENT = 'Без підрозділу';

//підрозділ → кореневе обладнання → діти → онуки; корінь — вузол, чийого батька немає в списку
function buildGroups(items: Equipment[]): TreeGroup[] {
  const nodes = new Map(items.map((item) => [item.equipment_id, { item, children: [] } as TreeNode]));
  const roots: TreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.item.parent_equipment_id === null ? undefined : nodes.get(node.item.parent_equipment_id);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const size = (node: TreeNode): number => 1 + node.children.reduce((sum, child) => sum + size(child), 0);
  const groups = new Map<string, TreeGroup>();
  for (const root of roots) {
    const key = String(root.item.root_department_id ?? 'none');
    const group = groups.get(key) ?? { key, name: root.item.department_name ?? NO_DEPARTMENT, nodes: [], count: 0 };
    group.nodes.push(root);
    group.count += size(root);
    groups.set(key, group);
  }

  return [...groups.values()].sort((a, b) =>
    a.key === 'none' ? 1 : b.key === 'none' ? -1 : a.name.localeCompare(b.name, 'uk')
  );
}

function units(count: number): string {
  const last = count % 10;
  const teen = count % 100 >= 11 && count % 100 <= 14;
  if (last === 1 && !teen) return `${count} одиниця`;
  if (last >= 2 && last <= 4 && !teen) return `${count} одиниці`;
  return `${count} одиниць`;
}

function TreeToggle({ open, label, onToggle }: { open: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="eq-toggle"
      aria-expanded={open}
      aria-label={`${open ? 'Згорнути' : 'Розгорнути'}: ${label}`}
      title={open ? 'Згорнути' : 'Розгорнути'}
      onClick={onToggle}
    >
      {open ? '−' : '+'}
    </button>
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
  //за замовчуванням усе розгорнуто
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  if (items.length === 0) return <p className="empty">Обладнання немає.</p>;

  const toggle = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  function renderNode(node: TreeNode) {
    const { item } = node;
    const key = `e${item.equipment_id}`;
    const open = !collapsed.has(key);
    const content = (
      <>
        <span className="eq-name">{item.name}</span>
        <span className="eq-type">{item.type_name}</span>
        <span className="eq-inv">
          інв. <span className="eq-inv-number">{item.inventory_number}</span>
        </span>
      </>
    );

    return (
      <li key={item.equipment_id} className="eq-node">
        <div className={`eq-row${item.equipment_id === selectedId ? ' eq-row-selected' : ''}`}>
          {node.children.length > 0 ? (
            <TreeToggle open={open} label={item.name} onToggle={() => toggle(key)} />
          ) : (
            <span className="eq-toggle-space" />
          )}
          {onSelect ? (
            <button type="button" className="eq-label" onClick={() => onSelect(item)}>
              {content}
            </button>
          ) : (
            <span className="eq-label">{content}</span>
          )}
        </div>
        {node.children.length > 0 && open && <ul className="eq-branch">{node.children.map(renderNode)}</ul>}
      </li>
    );
  }

  return (
    <div className="eq-tree">
      {buildGroups(items).map((group) => {
        const key = `d${group.key}`;
        const open = !collapsed.has(key);
        return (
          <section key={key} className="eq-group">
            <div className="eq-group-head">
              <TreeToggle open={open} label={group.name} onToggle={() => toggle(key)} />
              <span className="eq-group-name">{group.name}</span>
              <span className="eq-count">{units(group.count)}</span>
            </div>
            {open && <ul className="eq-branch eq-branch-top">{group.nodes.map(renderNode)}</ul>}
          </section>
        );
      })}
    </div>
  );
}
