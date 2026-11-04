import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { ErrorText, Page, StatusBadge, formatDateTime, useLoad } from '../ui';
import type { Ticket } from '../types';

export default function RequestsPage() {
  const { data, error, reload } = useLoad<Ticket[]>('/tickets');
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const navigate = useNavigate();

  async function reject(ticketId: number) {
    try {
      await api('POST', `/tickets/${ticketId}/reject`, { reason });
      setRejecting(null);
      setReason('');
      setActionError('');
      reload();
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  return (
    <Page title="Заявки" hint="Заявки працівників. Виконання — на сторінці «Сьогодні».">
      <div className="inline-form">
        <button type="button" className="button button-primary" onClick={() => navigate('/new-request')}>
          Подати заявку
        </button>
        <span className="muted">наприклад, якщо про несправність повідомили телефоном</span>
      </div>
      <ErrorText text={error} />
      <table>
        <thead>
          <tr>
            <th>№</th>
            <th>Подано</th>
            <th>Хто</th>
            <th>Пристрій і що сталося</th>
            <th>Робота</th>
            <th>Статус</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data?.map((ticket) => (
            <tr key={ticket.ticket_id}>
              <td>{ticket.ticket_id}</td>
              <td>{formatDateTime(ticket.created_at)}</td>
              <td>{ticket.reported_by_name}</td>
              <td>
                {ticket.equipment_name} — {ticket.symptom_label}
                {ticket.description && <div className="muted">«{ticket.description}»</div>}
              </td>
              <td>{ticket.work_type && `${ticket.work_type_name}, ~${ticket.estimated_minutes} хв, людей: ${ticket.people_count}`}</td>
              <td>
                <StatusBadge status={ticket.status} />
                {ticket.reject_reason && <div className="muted">{ticket.reject_reason}</div>}
              </td>
              <td>
                {['NEW', 'SCHEDULED'].includes(ticket.status) &&
                  (rejecting === ticket.ticket_id ? (
                    <span className="inline-form">
                      <input placeholder="Причина" value={reason} onChange={(e) => setReason(e.target.value)} />
                      <button type="button" className="button button-danger" onClick={() => reject(ticket.ticket_id)}>
                        Відхилити
                      </button>
                      <ErrorText text={actionError} />
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => {
                        setRejecting(ticket.ticket_id);
                        setActionError('');
                      }}
                    >
                      Відхилити…
                    </button>
                  ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Page>
  );
}
