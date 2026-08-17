// ============================================
// SKYLAND ENERGY — Sidebar Component
// ============================================
import { navigate } from '../router.js';
import { createIcon } from './icons.js';
import { getCurrentUser, logout } from '../auth.js';
import { escapeHtml } from '../utils/helpers.js';

export function renderSidebar() {
  const user = getCurrentUser();
  const canManageUsers = ['super_admin', 'admin'].includes(user?.role);
  const canManageCatalog = ['super_admin', 'admin', 'manager'].includes(user?.role);
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.id = 'sidebar';

  sidebar.innerHTML = `
    <div class="sidebar-header">
      <img src="/Skyland Recreated Logo.svg" alt="Skyland Energy" class="sidebar-logo" />
      <div class="sidebar-brand">
        <span class="sidebar-brand-name">Skyland Energy</span>
        <span class="sidebar-brand-tagline">Quotation System</span>
      </div>
    </div>

    <nav class="sidebar-nav">
      <div class="sidebar-section-label">Main</div>
      <a class="sidebar-link" data-route="/dashboard" href="#/dashboard">
        ${createIcon('layout-dashboard')}
        <span>Dashboard</span>
      </a>
      <a class="sidebar-link" data-route="/products" href="#/products">
        ${createIcon('solar-panel')}
        <span>Product Catalog</span>
      </a>
      <a class="sidebar-link" data-route="/customers" href="#/customers">
        ${createIcon('users')}
        <span>Customers</span>
      </a>
      <a class="sidebar-link" data-route="/profile" href="#/profile">
        ${createIcon('user')}
        <span>My Account</span>
      </a>

      <div class="sidebar-section-label">Quotations</div>
      <a class="sidebar-link" data-route="/quotation-builder" href="#/quotation-builder">
        ${createIcon('file-plus')}
        <span>New Quotation</span>
      </a>
      <a class="sidebar-link" data-route="/quotations" href="#/quotations">
        ${createIcon('file-text')}
        <span>All Quotations</span>
      </a>

      ${canManageCatalog ? `<div class="sidebar-section-label">Management</div>
      <a class="sidebar-link" data-route="/rates" href="#/rates">
        ${createIcon('trending-up')}
        <span>Price List</span>
      </a>
      <a class="sidebar-link" data-route="/settings" href="#/settings">
        ${createIcon('settings')}
        <span>Settings</span>
      </a>
      ` : ''}
      ${canManageUsers ? `<a class="sidebar-link" data-route="/users" href="#/users">${createIcon('users')}<span>Team Access</span></a>` : ''}
    </nav>

    <div class="sidebar-footer">
      <div class="sidebar-user">
        ${user?.profilePicture ? `<img src="${escapeHtml(user.profilePicture)}" class="sidebar-user-avatar" alt="" />` : `<span class="sidebar-user-avatar sidebar-user-fallback">${escapeHtml(user?.firstName?.[0] || '?')}</span>`}
        <div><strong>${escapeHtml(`${user?.firstName || ''} ${user?.lastName || ''}`.trim())}</strong><small>${escapeHtml((user?.role || '').replaceAll('_', ' '))}</small></div>
        <button class="btn btn-ghost btn-icon btn-sm" id="logout-btn" title="Sign out">${createIcon('log-out')}</button>
      </div>
    </div>
  `;

  // Handle link clicks
  sidebar.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const route = link.getAttribute('data-route');
      navigate(route);

      // Close mobile sidebar
      if (window.innerWidth <= 1024) {
        sidebar.classList.remove('open');
        document.getElementById('sidebar-overlay')?.classList.remove('active');
      }
    });
  });

  sidebar.querySelector('#logout-btn')?.addEventListener('click', async () => {
    await logout();
    window.location.hash = '/login';
    window.location.reload();
  });

  return sidebar;
}

export function renderSidebarOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id = 'sidebar-overlay';
  overlay.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.remove('open');
    overlay.classList.remove('active');
  });
  return overlay;
}

export function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('active');
}
