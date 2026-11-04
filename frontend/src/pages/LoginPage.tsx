import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../auth';
import { ErrorText } from '../ui';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      if (isRegister) await signIn('/auth/register', form);
      else await signIn('/auth/login', { email: form.email, password: form.password });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const field = (name: keyof typeof form, label: string, type = 'text') => (
    <label>
      {label}
      <input type={type} value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} required />
    </label>
  );

  return (
    <main className="auth-page">
      <div className="auth-brand">
        <h1 className="auth-name">Управління ІТ-активами</h1>
        <p className="auth-purpose">Повідомте про несправність техніки — адміністратор складе план робіт.</p>
      </div>
      <form className="auth-card form" onSubmit={submit}>
        {isRegister && field('fullName', 'Прізвище та ім’я')}
        {field('email', 'Електронна пошта', 'email')}
        {field('password', 'Пароль', 'password')}
        <ErrorText text={error} />
        <button type="submit" className="button button-primary">
          {isRegister ? 'Зареєструватися' : 'Увійти'}
        </button>
        <button type="button" className="link-button" onClick={() => setIsRegister(!isRegister)}>
          {isRegister ? 'Вже маю обліковий запис' : 'Я новий працівник — зареєструватися'}
        </button>
      </form>
    </main>
  );
}
