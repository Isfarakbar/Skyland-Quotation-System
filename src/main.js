// ============================================
// SKYLAND ENERGY — Main Entry Point
// ============================================

// Styles
import './styles/variables.css';
import './styles/global.css';
import './styles/components.css';
import './styles/layout.css';

// Core
import { getDB } from './db/database.js';
import { registerRoute, initRouter, onBeforeNavigate, navigate } from './router.js';
import { renderSidebar, renderSidebarOverlay } from './components/sidebar.js';
import { getCurrentUser, restoreSession } from './auth.js';

// Pages
import { renderDashboard } from './pages/dashboard.js';
import { renderProducts } from './pages/products.js';
import { renderCustomers } from './pages/customers.js';
import { renderQuotationBuilder } from './pages/quotation-builder.js';
import { renderQuotations } from './pages/quotations.js';
import { renderRates } from './pages/rates.js';
import { renderSettings } from './pages/settings.js';
import { renderUsers } from './pages/users.js';
import { renderProfile } from './pages/profile.js';
import { renderForgotPassword, renderLogin, renderResetPassword, renderSignup } from './pages/auth.js';

async function init() {
  try {
    await restoreSession();

    registerRoute('/login', renderLogin);
    registerRoute('/signup', renderSignup);
    registerRoute('/forgot-password', renderForgotPassword);
    registerRoute('/reset-password', renderResetPassword);

    const user = getCurrentUser();
    if (!user) {
      onBeforeNavigate(path => {
        const publicRoutes = ['/login', '/signup', '/forgot-password', '/reset-password'];
        if (!publicRoutes.includes(path)) { navigate('/login'); return false; }
        return true;
      });
      initRouter('/login');
      return;
    }

    await getDB();

    // Build app shell
    const app = document.getElementById('app');
    app.innerHTML = '';
    app.className = 'app-layout';

    // Sidebar
    const sidebar = renderSidebar();
    const overlay = renderSidebarOverlay();
    app.appendChild(sidebar);
    app.appendChild(overlay);

    // Main content
    const main = document.createElement('main');
    main.className = 'main-content';
    main.innerHTML = '<div id="page-content"></div>';
    app.appendChild(main);

    // Register routes
    registerRoute('/dashboard', renderDashboard);
    registerRoute('/products', renderProducts);
    registerRoute('/customers', renderCustomers);
    registerRoute('/quotation-builder', renderQuotationBuilder);
    registerRoute('/quotations', renderQuotations);
    registerRoute('/rates', renderRates);
    registerRoute('/settings', renderSettings);
    registerRoute('/users', renderUsers);
    registerRoute('/profile', renderProfile);

    onBeforeNavigate(path => {
      if (['/login', '/signup', '/forgot-password'].includes(path)) { navigate('/dashboard'); return false; }
      if (path === '/users' && !['super_admin', 'admin'].includes(user.role)) { navigate('/dashboard'); return false; }
      if (['/rates', '/settings'].includes(path) && !['super_admin', 'admin', 'manager'].includes(user.role)) { navigate('/dashboard'); return false; }
      return true;
    });

    // Start router
    initRouter('/dashboard');

    console.log('⚡ Skyland Energy Quotation System initialized');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    document.getElementById('app').innerHTML = `
      <div class="app-loading">
        <p style="color: var(--color-danger);">Failed to load application</p>
        <p class="text-sm text-secondary">${error.message}</p>
        <button class="btn btn-primary" id="app-retry-btn">Retry</button>
      </div>
    `;
    document.getElementById('app-retry-btn')?.addEventListener('click', () => location.reload());
  }
}

// Boot
init();
