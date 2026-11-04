import { useState } from 'react';
import { api } from '../api';
import { RULES } from '../labels';
import { ErrorText, Page, RuleName, formatTime, useLoad } from '../ui';
import type { Rule, TodayPlan, Work } from '../types';

//текст помилки або ''
type Act = (method: string, path: string, body?: unknown) => Promise<string>;

export default function TodayPage() {
  const plan = useLoad<TodayPlan>('/plan');
  const [error, setError] = useState('');

  const act: Act = async (method, path, body) => {
    try {
      plan.setData(await api<TodayPlan>(method, path, body));
      return '';
    } catch (err) {
      return (err as Error).message;
    }
  };

  const pageAct = async (method: string, path: string, body?: unknown) => setError(await act(method, path, body));

  const data = plan.data;

  return (
    <Page title="Сьогодні" hint="Що робити зараз і що далі. План складається на початку зміни і після кожної виконаної роботи.">
      <ErrorText text={error || plan.error} />
      {data && (
        <>
          <section className="card">
            <h3 className="panel-title">Правило черговості</h3>
            {(Object.keys(RULES) as Rule[]).map((rule) => (
              <label key={rule} className="rule-option">
                <input type="radio" checked={data.rule === rule} onChange={() => pageAct('PUT', '/plan/rule', { rule })} />
                <RuleName rule={rule} />
              </label>
            ))}
            <button type="button" className="button" onClick={() => pageAct('POST', '/plan')}>
              Скласти план зараз
            </button>
          </section>

          <h3 className="panel-title">Зараз</h3>
          {data.current ? (
            <CurrentWork key={data.current.task_id} work={data.current} onAct={act} />
          ) : (
            <p className="empty">Зараз нічого не виконується — почніть першу роботу з плану.</p>
          )}

          <h3 className="panel-title">Далі сьогодні</h3>
          {data.next.length === 0 && <p className="empty">У плані на сьогодні більше нічого немає.</p>}
          {data.next.map((work, index) => (
            <div key={work.task_id}>
              {work.group_root_equipment_id && work.group_root_equipment_id !== data.next[index - 1]?.group_root_equipment_id && (
                <p className="group-caption">Група робіт: {work.group_root_name} — робиться за один візит</p>
              )}
              <WorkCard work={work} onAct={act} />
            </div>
          ))}

          <h3 className="panel-title">Чекають (сьогодні не вміщуються або надійшли після складання плану)</h3>
          {data.waiting.length === 0 && <p className="empty">Нічого не чекає.</p>}
          {data.waiting.map((work) => (
            <WorkCard key={work.task_id} work={work} onAct={act} />
          ))}

          <h3 className="panel-title">Виконано сьогодні</h3>
          {data.done.length === 0 && <p className="empty">Ще нічого.</p>}
          {data.done.map((work) => (
            <p key={work.task_id} className="work-where">
              {formatTime(work.finished_at)} — {describe(work)}, {work.actual_minutes} хв
            </p>
          ))}
        </>
      )}
    </Page>
  );
}

function describe(work: Work): string {
  const what = work.symptom_label ? `${work.work_type_name}: ${work.symptom_label}` : work.work_type_name;
  return `${what} · ${work.equipment_name}`;
}

function WorkInfo({ work }: { work: Work }) {
  return (
    <>
      <p className="work-what">
        <span className={`tag ${work.source === 'TICKET' ? 'tag-ticket' : 'tag-planned'}`}>
          {work.source === 'TICKET' ? `Заявка №${work.ticket_id}` : 'Планове обслуговування'}
        </span>{' '}
        {describe(work)} <span className="sticker">{work.inventory_number}</span>
      </p>
      <p className="muted">
        ~{work.estimated_minutes} хв · зачіпає людей: {work.people_count}
        {work.reported_by_name && ` · повідомив(ла) ${work.reported_by_name}`}
        {work.description && ` · «${work.description}»`}
      </p>
    </>
  );
}

function CurrentWork({ work, onAct }: { work: Work; onAct: Act }) {
  const startedMinutes = Math.max(1, Math.round((Date.now() - new Date(work.started_at!).getTime()) / 60000));
  const [minutes, setMinutes] = useState(String(startedMinutes));
  const [error, setError] = useState('');

  const done = async () => setError(await onAct('POST', `/tasks/${work.task_id}/complete`, { actualMinutes: Number(minutes) }));

  return (
    <section className="card card-active">
      <WorkInfo work={work} />
      <p className="muted">Розпочато о {formatTime(work.started_at)}</p>
      <label className="inline-form">
        Фактично тривала, хв
        <input type="number" min={1} className="input-narrow" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        <button type="button" className="button button-primary" onClick={done}>
          Готово
        </button>
      </label>
      <ErrorText text={error} />
    </section>
  );
}

//лише види з нормативом
function WorkCard({ work, onAct }: { work: Work; onAct: Act }) {
  const [editing, setEditing] = useState(false);
  const [workType, setWorkType] = useState(work.work_type);
  const [people, setPeople] = useState(String(work.people_count));
  const [error, setError] = useState('');

  function openEditor() {
    setWorkType(work.work_type);
    setPeople(String(work.people_count));
    setError('');
    setEditing(true);
  }

  async function save() {
    const message = await onAct('PATCH', `/tasks/${work.task_id}`, { workType, peopleCount: Number(people) });
    setError(message);
    if (!message) setEditing(false);
  }

  const start = async () => setError(await onAct('POST', `/tasks/${work.task_id}/start`));

  return (
    <section className="card">
      {work.planned_start_at && (
        <p className="work-time">
          {formatTime(work.planned_start_at)}–{formatTime(work.planned_end_at)}
        </p>
      )}
      <WorkInfo work={work} />
      {editing ? (
        <div className="inline-form">
          <select value={workType} onChange={(e) => setWorkType(e.target.value)}>
            {work.work_types.map((type) => (
              <option key={type.work_type} value={type.work_type}>
                {type.name}
              </option>
            ))}
          </select>
          <label>
            людей
            <input type="number" min={1} className="input-narrow" value={people} onChange={(e) => setPeople(e.target.value)} />
          </label>
          <button type="button" className="button button-primary" onClick={save}>
            Зберегти
          </button>
          <button type="button" className="link-button" onClick={() => setEditing(false)}>
            Скасувати
          </button>
        </div>
      ) : (
        <div className="inline-form">
          <button type="button" className="button button-primary" onClick={start}>
            Почати
          </button>
          <button type="button" className="link-button" onClick={openEditor}>
            Виправити вид робіт або кількість людей
          </button>
        </div>
      )}
      <ErrorText text={error} />
    </section>
  );
}
