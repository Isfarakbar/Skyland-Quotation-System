// ============================================
// SKYLAND ENERGY — Dashboard Page
// ============================================
import { getAllProducts, getAllCustomers, getAllQuotations } from '../db/database.js';
import { formatCurrency, formatCurrencyShort, formatDate, STATUS_CONFIG, SYSTEM_TYPES } from '../utils/helpers.js';
import { createIcon } from '../components/icons.js';
import { navigate } from '../router.js';

export async function renderDashboard() {
  const container = document.getElementById('page-content');

  const [products, customers, quotations] = await Promise.all([
    getAllProducts(),
    getAllCustomers(),
    getAllQuotations(),
  ]);

  // Calculate stats
  const now = new Date();
  const thisMonth = quotations.filter(q => {
    const d = new Date(q.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const pipeline = quotations
    .filter(q => q.status === 'sent' || q.status === 'draft')
    .reduce((sum, q) => sum + (q.grandTotal || 0), 0);

  const accepted = quotations.filter(q => q.status === 'accepted');
  const acceptedTotal = accepted.reduce((sum, q) => sum + (q.grandTotal || 0), 0);

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <button class="mobile-menu-toggle" id="mobile-menu-btn">
          ${createIcon('menu')}
        </button>
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Welcome to Skyland Energy Quotation System</p>
        </div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-primary" id="new-quote-btn">
          ${createIcon('plus')} New Quotation
        </button>
      </div>
    </div>

    <div class="page-body">
      <!-- Stats Grid -->
      <div class="stats-grid">
        <div class="card card-elevated stat-card stat-card-primary animate-fade-in" style="animation-delay: 0ms">
          <div class="card-header">
            <div class="stat-icon stat-icon-primary">${createIcon('package')}</div>
          </div>
          <div class="stat-value" data-count="${products.length}">0</div>
          <div class="stat-label">Products in Catalog</div>
        </div>

        <div class="card card-elevated stat-card stat-card-blue animate-fade-in" style="animation-delay: 80ms">
          <div class="card-header">
            <div class="stat-icon stat-icon-blue">${createIcon('users')}</div>
          </div>
          <div class="stat-value" data-count="${customers.length}">0</div>
          <div class="stat-label">Customers</div>
        </div>

        <div class="card card-elevated stat-card stat-card-green animate-fade-in" style="animation-delay: 160ms">
          <div class="card-header">
            <div class="stat-icon stat-icon-green">${createIcon('file-text')}</div>
          </div>
          <div class="stat-value" data-count="${thisMonth.length}">0</div>
          <div class="stat-label">Quotations This Month</div>
        </div>

        <div class="card card-elevated stat-card stat-card-orange animate-fade-in" style="animation-delay: 240ms">
          <div class="card-header">
            <div class="stat-icon stat-icon-orange">${createIcon('dollar-sign')}</div>
          </div>
          <div class="stat-value" data-currency="${pipeline}">PKR 0</div>
          <div class="stat-label">Revenue Pipeline</div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="card card-elevated animate-fade-in" style="animation-delay: 300ms; margin-bottom: 2rem;">
        <div class="card-header">
          <h3 class="card-title">${createIcon('zap')} Quick Actions</h3>
        </div>
        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
          <button class="btn btn-primary" data-action="new-quotation">
            ${createIcon('file-plus')} Create Quotation
          </button>
          <button class="btn btn-secondary" data-action="add-product">
            ${createIcon('plus')} Add Product
          </button>
          <button class="btn btn-secondary" data-action="add-customer">
            ${createIcon('plus')} Add Customer
          </button>
          <button class="btn btn-outline" data-action="view-rates">
            ${createIcon('trending-up')} View Rates
          </button>
        </div>
      </div>

      <!-- Recent Quotations -->
      <div class="card card-elevated animate-fade-in" style="animation-delay: 380ms">
        <div class="card-header">
          <h3 class="card-title">Recent Quotations</h3>
          <button class="btn btn-ghost btn-sm" data-action="view-all-quotes">View All ${createIcon('arrow-right')}</button>
        </div>
        ${quotations.length === 0 ? `
          <div class="empty-state" style="padding: 3rem 1rem;">
            <div class="empty-state-icon">${createIcon('file-text', 48)}</div>
            <h4 class="empty-state-title">No quotations yet</h4>
            <p class="empty-state-text">Create your first quotation to get started</p>
            <button class="btn btn-primary" data-action="new-quotation">
              ${createIcon('plus')} Create Quotation
            </button>
          </div>
        ` : `
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Ref #</th>
                  <th>Customer</th>
                  <th>System</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${quotations.slice(0, 8).map(q => {
                  const customer = customers.find(c => c.id === q.customerId);
                  const status = STATUS_CONFIG[q.status] || STATUS_CONFIG.draft;
                  return `
                    <tr style="cursor: pointer;" data-quotation-id="${q.id}">
                      <td><strong>${q.quotationNumber || '-'}</strong></td>
                      <td>${customer ? customer.name : 'Unknown'}</td>
                      <td>${q.systemSize || '-'} KW ${SYSTEM_TYPES[q.systemType] || ''}</td>
                      <td><strong>${formatCurrency(q.grandTotal)}</strong></td>
                      <td><span class="badge ${status.class}">${status.label}</span></td>
                      <td>${formatDate(q.createdAt)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;

  // Animate counters
  container.querySelectorAll('.stat-value[data-count]').forEach(el => {
    animateCounter(el, parseInt(el.dataset.count) || 0);
  });

  container.querySelectorAll('.stat-value[data-currency]').forEach(el => {
    animateCurrencyCounter(el, parseFloat(el.dataset.currency) || 0);
  });

  // Event listeners
  container.querySelector('#new-quote-btn')?.addEventListener('click', () => navigate('/quotation-builder'));
  container.querySelector('#mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
    document.getElementById('sidebar-overlay')?.classList.toggle('active');
  });

  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'new-quotation') navigate('/quotation-builder');
      if (action === 'add-product') navigate('/products');
      if (action === 'add-customer') navigate('/customers');
      if (action === 'view-rates') navigate('/rates');
      if (action === 'view-all-quotes') navigate('/quotations');
    });
  });

  container.querySelectorAll('[data-quotation-id]').forEach(row => {
    row.addEventListener('click', () => {
      navigate('/quotations/' + row.dataset.quotationId);
    });
  });
}

function animateCounter(el, target) {
  let current = 0;
  const duration = 800;
  const start = performance.now();
  const step = (timestamp) => {
    const progress = Math.min((timestamp - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    current = Math.floor(eased * target);
    el.textContent = current.toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function animateCurrencyCounter(el, target) {
  let current = 0;
  const duration = 1000;
  const start = performance.now();
  const step = (timestamp) => {
    const progress = Math.min((timestamp - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    current = Math.floor(eased * target);
    el.textContent = formatCurrencyShort(current);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
