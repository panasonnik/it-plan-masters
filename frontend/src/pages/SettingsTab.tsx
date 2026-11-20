import { useState } from 'react';
import { api } from '../api';
import { RULES, SETTINGS } from '../labels';
import { ErrorText, RuleName, useLoad } from '../ui';
import type { Rule, TodayPlan } from '../types';

interface Setting {
  setting_key: string;
  setting_value: string;
  description: string | null;
}

//питання і пояснення — з labels.ts; ключі в БД не змінюються
export default function SettingsTab() {
  const settings = useLoad<Setting[]>('/references/settings');
  const plan = useLoad<TodayPlan>('/plan');
  const [ruleError, setRuleError] = useState('');

  async function changeRule(rule: Rule) {
    try {
      plan.setData(await api<TodayPlan>('PUT', '/plan/rule', { rule }));
      setRuleError('');
    } catch (err) {
      setRuleError((err as Error).message);
    }
  }

  return (
    <div className="settings">
      <section className="card">
        <h3 className="panel-title">{SETTINGS.ALGORITHM.question}</h3>
        <p className="muted">{SETTINGS.ALGORITHM.hint}</p>
        {plan.data &&
          (Object.keys(RULES) as Rule[]).map((rule) => (
            <label key={rule} className="rule-option">
              <input type="radio" checked={plan.data!.rule === rule} onChange={() => changeRule(rule)} />
              <RuleName rule={rule} />
            </label>
          ))}
        <ErrorText text={ruleError || plan.error} />
      </section>

      <ErrorText text={settings.error} />
      {settings.data?.map((setting) => (
        <SettingCard key={setting.setting_key} setting={setting} onSaved={settings.reload} />
      ))}
    </div>
  );
}

function SettingCard({ setting, onSaved }: { setting: Setting; onSaved: () => void }) {
  const label = SETTINGS[setting.setting_key];
  const [value, setValue] = useState(setting.setting_value);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function save() {
    try {
      await api('PUT', `/references/settings/${setting.setting_key}`, { setting_value: value });
      setError('');
      setMessage('Збережено');
      onSaved();
    } catch (err) {
      setMessage('');
      setError((err as Error).message);
    }
  }

  return (
    <section className="card">
      <h3 className="panel-title">{label?.question ?? setting.description ?? setting.setting_key}</h3>
      {label?.hint && <p className="muted">{label.hint}</p>}
      <div className="inline-form">
        <input
          className="input-narrow"
          type="number"
          min={0}
          value={value}
          aria-label={label?.question ?? setting.setting_key}
          onChange={(e) => {
            setValue(e.target.value);
            setMessage('');
          }}
        />
        {label?.unit && <span>{label.unit}</span>}
        <button type="button" className="button button-primary" disabled={value === setting.setting_value} onClick={save}>
          Зберегти
        </button>
        {message && <span className="muted">{message}</span>}
      </div>
      <ErrorText text={error} />
    </section>
  );
}
