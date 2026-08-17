import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AppShell } from './components/AppShell';
import { ErrorState, LoadingState } from './components/ui';

const AuthPage = lazy(() => import('./pages/AuthPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Products = lazy(() => import('./pages/Products'));
const Customers = lazy(() => import('./pages/Customers'));
const Quotations = lazy(() => import('./pages/Quotations'));
const QuotationBuilder = lazy(() => import('./pages/QuotationBuilder'));
const Rates = lazy(() => import('./pages/Rates'));
const Settings = lazy(() => import('./pages/Settings'));
const Team = lazy(() => import('./pages/Team'));
const Profile = lazy(() => import('./pages/Profile'));
const Audit = lazy(() => import('./pages/Audit'));

class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Page rendering failed', error, info); }
  render() { return this.state.error ? <ErrorState error={this.state.error} retry={() => this.setState({ error: null })}/> : this.props.children; }
}

function Protected() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState label="Opening your workspace"/>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }}/>;
  return <AppShell/>;
}

function PublicOnly() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState label="Checking your session"/>;
  return user ? <Navigate to="/dashboard" replace/> : <AuthPage/>;
}

function Permission({ permission, roles, children }: { permission?: string; roles?: string[]; children: ReactNode }) {
  const { user, hasPermission } = useAuth();
  if ((permission && !hasPermission(permission)) || (roles && !roles.includes(user?.role || ''))) return <Navigate to="/dashboard" replace/>;
  return children;
}

export function App() {
  return <HashRouter><Boundary><Suspense fallback={<LoadingState label="Loading page"/>}><Routes>
    <Route path="/login" element={<PublicOnly/>}/><Route path="/signup" element={<PublicOnly/>}/><Route path="/forgot-password" element={<PublicOnly/>}/><Route path="/reset-password/:token" element={<PublicOnly/>}/><Route path="/verify-email/:token" element={<PublicOnly/>}/>
    <Route element={<Protected/>}>
      <Route path="/dashboard" element={<Dashboard/>}/><Route path="/products" element={<Products/>}/><Route path="/customers" element={<Customers/>}/>
      <Route path="/quotations" element={<Quotations/>}/><Route path="/quotation-builder" element={<QuotationBuilder/>}/><Route path="/quotation-builder/:id" element={<QuotationBuilder/>}/>
      <Route path="/rates" element={<Permission permission="rates_view"><Rates/></Permission>}/><Route path="/settings" element={<Permission permission="settings_manage"><Settings/></Permission>}/>
      <Route path="/users" element={<Permission roles={['super_admin','admin']}><Team/></Permission>}/><Route path="/profile" element={<Profile/>}/><Route path="/audit" element={<Permission permission="audit_view"><Audit/></Permission>}/>
    </Route>
    <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
  </Routes></Suspense></Boundary></HashRouter>;
}
