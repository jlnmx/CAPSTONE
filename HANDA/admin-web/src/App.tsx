import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import AdminShell from './components/AdminShell';
import LoginView from './views/LoginView';
import DashboardView from './views/DashboardView';
import RecordsView from './views/RecordsView';
import CentersView from './views/CentersView';
import UsersView from './views/UsersView';
import { AnalyticsView, DisastersView, LogsView, SettingsView, SystemView } from './views/ManagementViews';

function ProtectedLayout() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="app-loading"><span className="loader" /><span>Checking secure session</span></div>;
  if (!user || user.role !== 'admin') return <Navigate to="/login" replace />;
  return <AdminShell><Outlet /></AdminShell>;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user?.role === 'admin' ? <Navigate to="/" replace /> : <LoginView />} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<DashboardView />} />
        <Route path="operations" element={<RecordsView mode="all" />} />
        <Route path="evacuees" element={<RecordsView mode="evacuees" />} />
        <Route path="centers" element={<CentersView />} />
        <Route path="disasters" element={<DisastersView />} />
        <Route path="analytics" element={<AnalyticsView />} />
        <Route path="users" element={<UsersView />} />
        <Route path="logs" element={<LogsView />} />
        <Route path="system" element={<SystemView />} />
        <Route path="settings" element={<SettingsView />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  );
}