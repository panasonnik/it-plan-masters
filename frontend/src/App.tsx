import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import LoginPage from './pages/LoginPage';
import MyEquipmentPage from './pages/MyEquipmentPage';
import NewRequestPage from './pages/NewRequestPage';
import MyRequestsPage from './pages/MyRequestsPage';
import NotificationsPage from './pages/NotificationsPage';
import TodayPage from './pages/TodayPage';
import RequestsPage from './pages/RequestsPage';
import EquipmentPage from './pages/EquipmentPage';
import ReferencesPage from './pages/ReferencesPage';
import ReportPage from './pages/ReportPage';

const EMPLOYEE_LINKS = [
  ['/my-equipment', 'Моє обладнання'],
  ['/my-requests', 'Мої заявки'],
  ['/notifications', 'Сповіщення'],
];

const ADMIN_LINKS = [
  ['/today', 'Сьогодні'],
  ['/requests', 'Заявки'],
  ['/equipment', 'Обладнання'],
  ['/references', 'Довідники'],
  ['/report', 'Втрати часу'],
  ['/notifications', 'Сповіщення'],
];

export default function App() {
  const { user, ready, signOut } = useAuth();

  if (!ready) return null;
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  const isAdmin = user.role === 'IT_ADMIN';
  const links = isAdmin ? ADMIN_LINKS : EMPLOYEE_LINKS;

  return (
    <>
      <header className="header">
        <div className="header-inner layout">
          <h1 className="header-title">Управління ІТ-активами</h1>
          <nav className="nav">
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} className="nav-link">
                {label}
              </NavLink>
            ))}
          </nav>
          <span className="header-user">
            {user.full_name}
            <button type="button" className="link-button" onClick={signOut}>
              Вийти
            </button>
          </span>
        </div>
      </header>

      <div className="layout">
        <Routes>
          <Route path="/notifications" element={<NotificationsPage />} />
          {isAdmin ? (
            <>
              <Route path="/today" element={<TodayPage />} />
              <Route path="/requests" element={<RequestsPage />} />
              <Route path="/new-request" element={<NewRequestPage />} />
              <Route path="/new-request/:equipmentId" element={<NewRequestPage />} />
              <Route path="/equipment" element={<EquipmentPage />} />
              <Route path="/references" element={<ReferencesPage />} />
              <Route path="/report" element={<ReportPage />} />
              <Route path="*" element={<Navigate to="/today" replace />} />
            </>
          ) : (
            <>
              <Route path="/my-equipment" element={<MyEquipmentPage />} />
              <Route path="/new-request/:equipmentId" element={<NewRequestPage />} />
              <Route path="/my-requests" element={<MyRequestsPage />} />
              <Route path="*" element={<Navigate to="/my-equipment" replace />} />
            </>
          )}
        </Routes>
      </div>
    </>
  );
}
