import { api } from '../api';
import { useAuth } from '../auth';
import { ErrorText, Page, formatDateTime, useLoad } from '../ui';
import type { Notification } from '../types';

export default function NotificationsPage() {
  const { user } = useAuth();
  const { data, error, reload } = useLoad<Notification[]>('/notifications');
  const isAdmin = user?.role === 'IT_ADMIN';
  const hasUnread = data?.some((note) => !note.is_read) ?? false;

  async function markRead(id: number) {
    await api('POST', `/notifications/${id}/read`);
    reload();
  }

  async function markAllRead() {
    await api('POST', '/notifications/read-all');
    reload();
  }

  return (
    <Page
      title="Сповіщення"
      hint={
        isAdmin
          ? 'Журнал подій: нові заявки, початок, завершення й виправлення робіт, відхилені заявки, планові роботи.'
          : 'Зміни статусу ваших заявок і заявок на закріплену за вами техніку, планові роботи з неї.'
      }
    >
      <ErrorText text={error} />
      {hasUnread && (
        <p>
          <button type="button" className="button" onClick={markAllRead}>
            Позначити всі прочитаними
          </button>
        </p>
      )}
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
