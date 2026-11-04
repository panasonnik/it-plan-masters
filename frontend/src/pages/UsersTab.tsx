import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import { ErrorText, useLoad } from '../ui';
import type { User } from '../types';

export default function UsersTab() {
  const { data, error, reload } = useLoad<User[]>('/users');
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'EMPLOYEE' });
  const [actionError, setActionError] = useState('');

  async function run(action: Promise<unknown>) {
    try {
      await action;
      setActionError('');
      reload();
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  function create(event: FormEvent) {
    event.preventDefault();
    run(api('POST', '/users', form)).then(() => setForm({ fullName: '', email: '', password: '', role: 'EMPLOYEE' }));
  }

  return (
    <>
      <ErrorText text={error || actionError} />
      <table>
        <thead>
          <tr>
            <th>Ім’я</th>
            <th>Пошта</th>
            <th>Роль</th>
            <th>Активний</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((user) => (
            <tr key={user.user_id}>
              <td>{user.full_name}</td>
              <td>{user.email}</td>
              <td>
                <select value={user.role} onChange={(e) => run(api('PATCH', `/users/${user.user_id}`, { role: e.target.value }))}>
                  <option value="EMPLOYEE">Працівник</option>
                  <option value="IT_ADMIN">Адміністратор</option>
                </select>
              </td>
              <td>
                <input type="checkbox" checked={user.is_active} onChange={(e) => run(api('PATCH', `/users/${user.user_id}`, { isActive: e.target.checked }))} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form className="inline-form" onSubmit={create}>
        <input placeholder="Прізвище та ім’я" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <input placeholder="Пошта" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input placeholder="Пароль" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="EMPLOYEE">Працівник</option>
          <option value="IT_ADMIN">Адміністратор</option>
        </select>
        <button type="submit" className="button">
          + Додати
        </button>
      </form>
    </>
  );
}
