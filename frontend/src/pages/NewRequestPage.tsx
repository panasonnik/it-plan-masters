import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { EquipmentTree, ErrorText, Page, useLoad } from '../ui';
import type { Equipment } from '../types';

export default function NewRequestPage() {
  const isAdmin = useAuth().user?.role === 'IT_ADMIN';
  const equipmentId = Number(useParams().equipmentId);

  return equipmentId ? <RequestForm equipmentId={equipmentId} isAdmin={isAdmin} /> : <DevicePicker />;
}

function DevicePicker() {
  const { data, error } = useLoad<Equipment[]>('/equipment');
  const navigate = useNavigate();

  return (
    <Page title="Нова заявка" hint="Натисніть на пристрій, з яким сталася несправність. Заявку можна подати на будь-яке обладнання.">
      <ErrorText text={error} />
      {data && <EquipmentTree items={data} onSelect={(item) => navigate(`/new-request/${item.equipment_id}`)} />}
    </Page>
  );
}

function RequestForm({ equipmentId, isAdmin }: { equipmentId: number; isAdmin: boolean }) {
  const navigate = useNavigate();
  const equipment = useLoad<Equipment[]>(isAdmin ? '/equipment' : '/equipment/my');
  const symptoms = useLoad<{ symptom_id: number; label: string }[]>(`/references/symptoms-for/${equipmentId}`);
  const [symptomId, setSymptomId] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const device = equipment.data?.find((item) => item.equipment_id === equipmentId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await api('POST', '/tickets', { equipmentId, symptomId: Number(symptomId), description: description || undefined });
      navigate(isAdmin ? '/requests' : '/my-requests');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Page title="Нова заявка" hint="Оберіть, що сталося. Решту система визначить сама.">
      <form className="form" onSubmit={submit}>
        <p>
          Пристрій: <strong>{device ? device.name : '…'}</strong> {device && <span className="sticker">{device.inventory_number}</span>}
        </p>
        <label>
          Що сталося
          <select value={symptomId} onChange={(e) => setSymptomId(e.target.value)} required>
            <option value="">— оберіть —</option>
            {symptoms.data?.map((symptom) => (
              <option key={symptom.symptom_id} value={symptom.symptom_id}>
                {symptom.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Опис (необов'язково)
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>
        <ErrorText text={error || symptoms.error} />
        <button type="submit" className="button button-primary">
          Надіслати заявку
        </button>
      </form>
    </Page>
  );
}
