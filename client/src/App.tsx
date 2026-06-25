import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/NotFound';
import { Route, Switch, useLocation } from 'wouter';
import { lazy, Suspense, useEffect, type ReactElement } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

const Home = lazy(() => import('./pages/Home'));
const CompanyIdentityPage = lazy(() => import('./pages/CompanyIdentity'));
const LoginPage = lazy(() => import('./pages/Login'));
const AdminPortalPage = lazy(() => import('./pages/AdminPortal'));
const CustomerPortalPage = lazy(() => import('./pages/CustomerPortal'));
const SystemManagementPage = lazy(() => import('./pages/SystemManagement'));
const ForcePasswordChangePage = lazy(() => import('./pages/ForcePasswordChange'));

function isAdminRole(role?: string) {
  return role === 'system_admin' || role === 'risk_admin';
}

function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(to);
  }, [setLocation, to]);
  return null;
}

function LoadingScreen({ label = 'Checking your session...' }: { label?: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontWeight: 900, color: '#0f172a' }}>
      {label}
    </div>
  );
}

function ProtectedRoute({ children, adminOnly = false }: { children: ReactElement; adminOnly?: boolean }) {
  const { loading, isAuthenticated, user } = useAuth();
  const [location] = useLocation();

  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (user?.must_change_password && location !== '/change-password') return <Redirect to="/change-password" />;
  if (adminOnly && !isAdminRole(user?.role)) return <Redirect to="/customer" />;

  return children;
}

function PublicOnlyRoute({ children }: { children: ReactElement }) {
  const { loading, isAuthenticated, user } = useAuth();

  if (loading) return <LoadingScreen label="Loading..." />;
  if (isAuthenticated && user?.must_change_password) return <Redirect to="/change-password" />;
  if (isAuthenticated) return <Redirect to={isAdminRole(user?.role) ? '/admin' : '/customer'} />;

  return children;
}

function PortalRedirect() {
  const { loading, isAuthenticated, user } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (user?.must_change_password) return <Redirect to="/change-password" />;
  return <Redirect to={isAdminRole(user?.role) ? '/admin' : '/customer'} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login">
        <PublicOnlyRoute><LoginPage /></PublicOnlyRoute>
      </Route>
      <Route path="/change-password">
        <ProtectedRoute><ForcePasswordChangePage /></ProtectedRoute>
      </Route>

      <Route path="/admin/dashboard">
        <ProtectedRoute adminOnly><Home portal="admin" /></ProtectedRoute>
      </Route>
      <Route path="/admin/company-identity">
        <ProtectedRoute adminOnly><CompanyIdentityPage /></ProtectedRoute>
      </Route>
      <Route path="/admin/management">
        <ProtectedRoute adminOnly><SystemManagementPage /></ProtectedRoute>
      </Route>
      <Route path="/admin">
        <ProtectedRoute adminOnly><AdminPortalPage /></ProtectedRoute>
      </Route>

      <Route path="/customer/dashboard">
        <ProtectedRoute><Home portal="customer" /></ProtectedRoute>
      </Route>
      <Route path="/customer">
        <ProtectedRoute><CustomerPortalPage /></ProtectedRoute>
      </Route>

      <Route path="/company-identity">
        <ProtectedRoute adminOnly><Redirect to="/admin/company-identity" /></ProtectedRoute>
      </Route>
      <Route path="/">
        <PortalRedirect />
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Suspense fallback={<LoadingScreen label="Loading page..." />}>
              <Router />
            </Suspense>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
