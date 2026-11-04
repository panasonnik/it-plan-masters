import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import { EquipmentTree, ErrorText, Page, useLoad } from '../ui';
import type { Equipment, Row, User } from '../types';

const EMPTY = { inventoryNumber: '', name: '', equipmentTypeId: '', parentEquipmentId: '', assignedUserId: '', affectedPeople: '' };

function formOf(item: Equipment) {
  return {
    inventoryNumber: item.inventory_number,
    name: item.name,
    equipmentTypeId: String(item.equipment_type_id),
    parentEquipmentId: String(item.parent_equipment_id ?? ''),
    assignedUserId: String(item.assigned_user_id ?? ''),
    affectedPeople: String(item.affected_people ?? ''),
  };
}

export default function EquipmentPage() {
  const equipment = useLoad<Equipment[]>('/equipment');
  const types = useLoad<Row[]>('/references/equipment-types');
  const users = useLoad<User[]>('/users');
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  function select(item: Equipment | null) {
    setSelected(item);
    setForm(item ? formOf(item) : EMPTY);
    setError('');
  }

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
      setError('');
      equipment.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    const body = {
      ...form,
      parentEquipmentId: form.parentEquipmentId || null,
      assignedUserId: form.assignedUserId || null,
      affectedPeople: form.affectedPeople || null,
    };
    run(() => (selected ? api('PATCH', `/equipment/${selected.equipment_id}`, body) : api('POST', '/equipment', body)));
  }

  const current = equipment.data?.find((item) => item.equipment_id === selected?.equipment_id) ?? null;
  const userName = (id: number) => users.data?.find((user) => user.user_id === id)?.full_name ?? `#${id}`;
  const field = (name: keyof typeof EMPTY, label: string, options?: [string | number, string][]) => (
    <label>
      {label}
      {options ? (
        <select value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })}>
          <option value="">—</option>
          {options.map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      ) : (
        <input value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} />
      )}
    </label>
  );

  return (
    <Page title="Обладнання" hint="Оберіть вузол у дереві, щоб змінити його, закріпити за працівником чи додати споживачів.">
      <div className="split">
        <div>
          <button type="button" className="button" onClick={() => select(null)}>
            + Нове обладнання
          </button>
          {equipment.data && <EquipmentTree items={equipment.data} selectedId={selected?.equipment_id} onSelect={select} />}
        </div>

        <div className="split-side">
          <form className="form" onSubmit={save}>
            <h3 className="panel-title">{current ? current.name : 'Нове обладнання'}</h3>
            {field('inventoryNumber', 'Інвентарний номер')}
            {field('name', 'Назва')}
            {field('equipmentTypeId', 'Тип', types.data?.map((t) => [t.equipment_type_id as number, t.name as string]))}
            {field('parentEquipmentId', 'Входить до складу', equipment.data?.map((e) => [e.equipment_id, e.name]))}
            {field('assignedUserId', 'Закріплено за працівником', users.data?.map((u) => [u.user_id, u.full_name]))}
            {current && <p className="muted">Система пропонує кількість людей: {current.proposed_people}</p>}
            {field('affectedPeople', 'Кількість людей (порожньо — як пропонує система)')}
            <ErrorText text={error || equipment.error} />
            <button type="submit" className="button button-primary">
              Зберегти
            </button>
            {current && (
              <button type="button" className="button button-danger" onClick={() => run(() => api('DELETE', `/equipment/${current.equipment_id}`)).then(() => select(null))}>
                Видалити
              </button>
            )}
          </form>

          {current && (
            <section className="card">
              <h3 className="panel-title">Хто ще користується</h3>
              {current.consumer_ids?.length === 0 && <p className="muted">Ніхто, крім закріпленого працівника.</p>}
              {current.consumer_ids?.map((userId) => (
                <p key={userId}>
                  {userName(userId)}{' '}
                  <button type="button" className="link-button" onClick={() => run(() => api('DELETE', `/equipment/${current.equipment_id}/consumers/${userId}`))}>
                    прибрати
                  </button>
                </p>
              ))}
              <select value="" onChange={(e) => run(() => api('POST', `/equipment/${current.equipment_id}/consumers`, { userId: Number(e.target.value) }))}>
                <option value="">+ додати працівника</option>
                {users.data?.map((user) => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.full_name}
                  </option>
                ))}
              </select>
            </section>
          )}
        </div>
      </div>
    </Page>
  );
}
