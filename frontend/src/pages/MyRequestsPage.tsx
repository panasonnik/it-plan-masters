import { ErrorText, Page, StatusBadge, formatDateTime, useLoad } from '../ui';
import type { Ticket } from '../types';

export default function MyRequestsPage() {
  const { data, error } = useLoad<Ticket[]>('/tickets/my');

  return (
    <Page title="Мої заявки" hint="Тут видно, що відбувається з кожною вашою заявкою.">
      <ErrorText text={error} />
      {data?.length === 0 && <p className="empty">Ви ще не подавали заявок.</p>}
      {data?.map((ticket) => (
        <section key={ticket.ticket_id} className="card">
          <h3 className="panel-title">
            Заявка №{ticket.ticket_id} · {ticket.equipment_name} <StatusBadge status={ticket.status} />
          </h3>
          <p>
            {ticket.symptom_label}
            {ticket.description && ` — «${ticket.description}»`}
          </p>
          {ticket.reject_reason && <p className="error">Причина відхилення: {ticket.reject_reason}</p>}
          <ol className="history">
            {ticket.history?.map((row, index) => (
              <li key={index}>
                {formatDateTime(row.changed_at)} — <StatusBadge status={row.status} /> {row.comment}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </Page>
  );
}
