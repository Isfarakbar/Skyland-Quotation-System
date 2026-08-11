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
import { seedDatabase } from './db/seed-data.js';
import { registerRoute, initRouter } from './router.js';
import { renderSidebar, renderSidebarOverlay } from './components/sidebar.js';

// Pages
import { renderDashboard } from './pages/dashboard.js';
import { renderProducts } from './pages/products.js';
import { renderCustomers } from './pages/customers.js';
import { renderQuotationBuilder } from './pages/quotation-builder.js';
import { renderQuotations } from './pages/quotations.js';
import { renderRates } from './pages/rates.js';
import { renderSettings } from './pages/settings.js';

async function init() {
  try {
    // Initialize database
    await getDB();
    await seedDatabase();

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

    // Start router
    initRouter('/dashboard');

    console.log('⚡ Skyland Energy Quotation System initialized');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    document.getElementById('app').innerHTML = `
      <div class="app-loading">
        <p style="color: var(--color-danger);">Failed to load application</p>
        <p class="text-sm text-secondary">${error.message}</p>
        <button class="btn btn-primary" onclick="location.reload()">Retry</button>
      </div>
    `;
  }
}

// Boot
init();
