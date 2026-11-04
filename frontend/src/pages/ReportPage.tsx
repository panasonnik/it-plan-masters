import { useState } from 'react';
import { ErrorText, Page, useLoad } from '../ui';

interface Downtime {
  works: number;
  z: number;
  zUnplanned: number;
  zPlanned: number;
  employees: number;
  s: number | null;
}

type HoursRow = { day_of_week: number };

function isoDate(date: Date): string {
  return date.toLocaleDateString('sv-SE');
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

//сьогодні включно
function workingDaysAgo(count: number, workingDays: Set<number>): Date {
  const isoDay = (date: Date) => date.getDay() || 7;
  const date = new Date();
  let left = workingDays.has(isoDay(date)) ? count - 1 : count;
  while (left > 0) {
    date.setDate(date.getDate() - 1);
    if (workingDays.has(isoDay(date))) left -= 1;
  }
  return date;
}

export default function ReportPage() {
  const today = new Date();
  const [from, setFrom] = useState(isoDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(isoDate(today));
  const { data, error } = useLoad<Downtime>(`/reports/downtime?from=${from}&to=${to}`);
  const workHours = useLoad<HoursRow[]>('/references/work-hours');
  const workingDays = new Set((workHours.data ?? []).map((row) => row.day_of_week));
  const hours = (minutes: number) => `${Math.round(minutes / 6) / 10} год`;

  const choose = (start: Date) => {
    setFrom(isoDate(start));
    setTo(isoDate(new Date()));
  };

  return (
    <Page title="Втрати робочого часу" hint="Скільки робочого часу люди втратили, поки чекали на ремонт і обслуговування.">
      <div className="inline-form">
        <label>
          З <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          по <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="button" className="button" title="Останні 7 днів" onClick={() => choose(daysAgo(6))}>
          Тиждень
        </button>
        <button type="button" className="button" title="Останні 30 днів" onClick={() => choose(daysAgo(29))}>
          Місяць
        </button>
        <button
          type="button"
          className="button"
          title="Останні 20 робочих днів за розкладом «Робочий час»"
          disabled={workingDays.size === 0}
          onClick={() => choose(workingDaysAgo(20, workingDays))}
        >
          20 робочих днів
        </button>
      </div>
      <ErrorText text={error} />
      {data && (
        <table>
          <tbody>
            <tr>
              <th>Виконано робіт</th>
              <td>{data.works}</td>
            </tr>
            <tr>
              <th>Втрати Z, людино-хвилин</th>
              <td>
                {data.z} ({hours(data.z)})
              </td>
            </tr>
            <tr>
              <th>з них через заявки</th>
              <td>{data.zUnplanned}</td>
            </tr>
            <tr>
              <th>з них через прострочене обслуговування</th>
              <td>{data.zPlanned}</td>
            </tr>
            <tr>
              <th>Простій одного працівника S, хвилин (працівників: {data.employees})</th>
              <td>{data.s ?? '—'}</td>
            </tr>
          </tbody>
        </table>
      )}
    </Page>
  );
}
