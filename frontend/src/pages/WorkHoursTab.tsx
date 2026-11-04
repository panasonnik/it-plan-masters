import { useEffect, useState } from 'react';
import { api } from '../api';
import { DAYS } from '../labels';
import { ErrorText, useLoad } from '../ui';

interface Day {
  working: boolean;
  start_time: string;
  end_time: string;
  break_start: string;
  break_end: string;
}

type HoursRow = { day_of_week: number; start_time: string; end_time: string; break_start: string | null; break_end: string | null };

const OFF: Day = { working: false, start_time: '09:00', end_time: '18:00', break_start: '13:00', break_end: '14:00' };

export default function WorkHoursTab() {
  const { data, error } = useLoad<HoursRow[]>('/references/work-hours');
  const [week, setWeek] = useState<Day[]>(DAYS.map(() => OFF));
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!data) return;
    const time = (value: string | null) => (value ?? '').slice(0, 5);
    setWeek(
      DAYS.map((_, index) => {
        const row = data.find((item) => item.day_of_week === index + 1);
        return row
          ? { working: true, start_time: time(row.start_time), end_time: time(row.end_time), break_start: time(row.break_start), break_end: time(row.break_end) }
          : OFF;
      })
    );
  }, [data]);

  async function save() {
    const days = week
      .map((day, index) => ({ ...day, day_of_week: index + 1, break_start: day.break_start || null, break_end: day.break_end || null }))
      .filter((day) => day.working);
    try {
      await api('PUT', '/references/work-hours', days);
      setMessage('Збережено');
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  const change = (index: number, patch: Partial<Day>) => setWeek(week.map((day, i) => (i === index ? { ...day, ...patch } : day)));

  return (
    <>
      <ErrorText text={error} />
      <table>
        <thead>
          <tr>
            <th>День</th>
            <th>Робочий</th>
            <th>Початок</th>
            <th>Кінець</th>
            <th>Обід з</th>
            <th>Обід до</th>
          </tr>
        </thead>
        <tbody>
          {week.map((day, index) => (
            <tr key={index}>
              <td>{DAYS[index]}</td>
              <td>
                <input type="checkbox" checked={day.working} onChange={(e) => change(index, { working: e.target.checked })} />
              </td>
              {(['start_time', 'end_time', 'break_start', 'break_end'] as const).map((key) => (
                <td key={key}>
                  <input type="time" disabled={!day.working} value={day[key]} onChange={(e) => change(index, { [key]: e.target.value })} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="button button-primary" onClick={save}>
        Зберегти тиждень
      </button>{' '}
      <span className="muted">{message}</span>
    </>
  );
}
