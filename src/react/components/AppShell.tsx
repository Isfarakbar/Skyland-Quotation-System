import * as Dialog from '@radix-ui/react-dialog';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { BarChart3, Boxes, Building2, Calculator, ChevronRight, FileText, LogOut, Menu, Settings, ShieldCheck, Tags, UserRound, UsersRound, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fullName, titleCase } from '../lib/format';
import skylandLogo from '../../../Skyland Recreated Logo.svg';

const mainNav = [
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/products', label: 'Product Catalog', icon: Boxes },
  { to: '/customers', label: 'Customers', icon: Building2 },
  { to: '/profile', label: 'My Account', icon: UserRound },
];
const quoteNav = [
  { to: '/quotation-builder', label: 'New Quotation', icon: Calculator },
  { to: '/quotations', label: 'Quotations', icon: FileText },
];

function SidebarContent({ close }: { close?: () => void }) {
  const { user, logout, hasPermission } = useAuth();
  const management = [
    hasPermission('rates_view') && { to: '/rates', label: 'Price List', icon: Tags },
    hasPermission('settings_manage') && { to: '/settings', label: 'Settings', icon: Settings },
    ['super_admin', 'admin'].includes(user?.role || '') && { to: '/users', label: 'Team Access', icon: UsersRound },
    hasPermission('audit_view') && { to: '/audit', label: 'Audit History', icon: ShieldCheck },
  ].filter(Boolean) as typeof mainNav;
  const section = (label: string, rows: typeof mainNav) => <div className="nav-section"><span>{label}</span>{rows.map(({ to, label: itemLabel, icon: Icon }) => <NavLink key={to} to={to} onClick={close} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon/><span>{itemLabel}</span><ChevronRight className="nav-chevron"/></NavLink>)}</div>;
  return <><div className="brand"><img className="brand-logo" src={skylandLogo} alt="Skyland Energy"/><div><strong>Skyland Energy</strong><small>Quotation System</small></div></div><nav>{section('Workspace', mainNav)}{section('Quotations', quoteNav)}{management.length > 0 && section('Management', management)}</nav><div className="sidebar-user"><div className="avatar">{user?.profilePicture ? <img src={user.profilePicture} alt=""/> : user?.firstName?.[0] || 'S'}</div><div><strong>{fullName(user || undefined)}</strong><span>{titleCase(user?.role || '')}</span></div><button onClick={logout} aria-label="Sign out" title="Sign out"><LogOut/></button></div></>;
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  return <div className="app-shell"><aside className="sidebar"><SidebarContent/></aside><div className="mobile-bar"><Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Trigger aria-label="Open navigation"><Menu/></Dialog.Trigger><div className="mobile-brand"><img className="brand-logo brand-logo--mobile" src={skylandLogo} alt="Skyland Energy"/><strong>Skyland</strong></div><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="mobile-drawer" aria-label="Navigation"><Dialog.Close className="drawer-close" aria-label="Close navigation"><X/></Dialog.Close><SidebarContent close={() => setOpen(false)}/></Dialog.Content></Dialog.Portal></Dialog.Root></div><main className="app-main"><Outlet/></main></div>;
}
