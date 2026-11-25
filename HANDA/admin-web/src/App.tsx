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

function AdminCategoryOnly({ categories, children }: { categories: Array<'BCDRRMO' | 'CSWD'>; children: ReactNode }) {
  const { user } = useAuth();
  return user?.isSuperAdmin || (user?.adminCategory && categories.includes(user.adminCategory))
    ? <>{children}</>
    : <Navigate to="/" replace />;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user?.role === 'admin' ? <Navigate to="/" replace /> : <LoginView />} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<DashboardView />} />
        <Route path="map" element={<AdminCategoryOnly categories={['BCDRRMO', 'CSWD']}><MapView /></AdminCategoryOnly>} />
        <Route path="operations" element={<AdminCategoryOnly categories={['BCDRRMO']}><RecordsView mode="incidents" /></AdminCategoryOnly>} />
        <Route path="dispatch" element={<AdminCategoryOnly categories={['BCDRRMO']}><DispatchView /></AdminCategoryOnly>} />
        <Route path="centers" element={<AdminCategoryOnly categories={['CSWD']}><CentersView /></AdminCategoryOnly>} />
        <Route path="centers/:centerId" element={<AdminCategoryOnly categories={['CSWD']}><CenterDetailView /></AdminCategoryOnly>} />
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