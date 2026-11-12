import type { ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import AdminShell from './components/AdminShell';
import LoginView from './views/LoginView';
import DashboardView from './views/DashboardView';
import MapView from './views/MapView';
import RecordsView from './views/RecordsView';
import CentersView from './views/CentersView';
import CenterDetailView from './views/CenterDetailView';
import UsersView from './views/UsersView';
import DispatchView from './views/DispatchView';
import { AnalyticsView, LogsView, SettingsView, SystemView } from './views/ManagementViews';

function ProtectedLayout() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="app-loading"><span className="loader" /><span>Checking secure session</span></div>;
  if (!user || user.role !== 'admin') return <Navigate to="/login" replace />;
  return <AdminShell><Outlet /></AdminShell>;
}

function SuperAdminOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user?.isSuperAdmin ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user?.role === 'admin' ? <Navigate to="/" replace /> : <LoginView />} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<DashboardView />} />
        <Route path="map" element={<MapView />} />
        <Route path="operations" element={<RecordsView mode="all" />} />
        <Route path="dispatch" element={<DispatchView />} />
        <Route path="centers" element={<CentersView />} />
        <Route path="centers/:centerId" element={<CenterDetailView />} />
        <Route path="analytics" element={<AnalyticsView />} />
        <Route path="users" element={<SuperAdminOnly><UsersView /></SuperAdminOnly>} />
        <Route path="logs" element={<LogsView />} />
        <Route path="system" element={<SystemView />} />
        <Route path="settings" element={<SettingsView />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  );
}