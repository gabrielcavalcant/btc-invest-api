import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { useSession } from './auth/session';
import { AppLayout } from './components/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { StatementPage } from './pages/StatementPage';
import { Skeleton } from './components/ui';

// The chart library is the heaviest dependency: loaded only when the page is opened
const MarketPage = lazy(() =>
  import('./pages/MarketPage').then((module) => ({ default: module.MarketPage })),
);

export function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route
        path="/cadastro"
        element={
          <PublicOnly>
            <RegisterPage />
          </PublicOnly>
        }
      />
      <Route
        element={
          <RequireSession>
            <AppLayout />
          </RequireSession>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="extrato" element={<StatementPage />} />
        <Route
          path="mercado"
          element={
            <Suspense fallback={<Skeleton className="h-96" />}>
              <MarketPage />
            </Suspense>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/** Private pages: without a session, go to login and come back afterwards. */
function RequireSession({ children }: { children: ReactNode }) {
  const session = useSession();
  const location = useLocation();
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

/** Login/registration make no sense with an open session. */
function PublicOnly({ children }: { children: ReactNode }) {
  return useSession() ? <Navigate to="/" replace /> : children;
}
