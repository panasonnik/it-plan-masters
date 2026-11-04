import { api } from '../api';
import { ErrorText, Page, formatDateTime, useLoad } from '../ui';
import type { Notification } from '../types';

export default function NotificationsPage() {
  const { data, error, reload } = useLoad<Notification[]>('/notifications');

  async function markRead(id: number) {
    await api('POST', `/notifications/${id}/read`);
    reload();
  }

  return (
    <Page title="Сповіщення" hint="Зміни статусу ваших заявок і планове обслуговування вашої техніки.">
      <ErrorText text={error} />
      {data?.length === 0 && <p className="empty">Сповіщень немає.</p>}
      {data?.map((note) => (
        <section key={note.notification_id} className={`card${note.is_read ? ' card-read' : ''}`}>
          <strong>{note.title}</strong>
          {note.body && <p>{note.body}</p>}
          <p className="muted">
            {formatDateTime(note.created_at)}{' '}
            {!note.is_read && (
              <button type="button" className="link-button" onClick={() => markRead(note.notification_id)}>
                Прочитано
              </button>
            )}
          </p>
        </section>
      ))}
    </Page>
  );
}
