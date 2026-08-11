// ============================================
// SKYLAND ENERGY — Rates Management Page
// ============================================
import { getAllProducts, updateProduct } from '../db/database.js';
import { formatCurrency, debounce } from '../utils/helpers.js';
import { createIcon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { toggleMobileSidebar } from '../components/sidebar.js';

export async function renderRates() {
  const container = document.getElementById('page-content');
  const products = await getAllProducts();

  const panels = products.filter(p => p.category === 'solar-panel');
  const inverters = products.filter(p => p.category === 'inverter');
  const batteries = products.filter(p => p.category === 'battery');

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <button class="mobile-menu-toggle" id="mobile-menu-btn">${createIcon('menu')}</button>
        <div>
          <h1 class="page-title">Rates Management</h1>
          <p class="page-subtitle">Update product prices — changes reflect in new quotations</p>
        </div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-primary" id="save-all-btn">
          ${createIcon('save')} Save All Changes
        </button>
      </div>
    </div>

    <div class="page-body">
      <!-- Solar Panel Rates -->
      <div class="card card-elevated" style="margin-bottom: 2rem;">
        <div class="card-header">
          <h3 class="card-title">${createIcon('solar-panel')} Solar Panel Rates</h3>
          <span class="text-sm text-secondary">Prices change weekly</span>
        </div>
        <div class="table-container">
          <table class="data-table" id="panel-rates-table">
            <thead>
              <tr>
                <th>Brand</th>
                <th>Model</th>
                <th>Wattage</th>
                <th>Rate/Watt (PKR)</th>
                <th>Unit Price (PKR)</th>
              </tr>
            </thead>
            <tbody>
              ${panels.map(p => `
                <tr data-product-id="${p.id}">
                  <td><strong>${p.brand}</strong></td>
                  <td>${p.model || '-'}</td>
                  <td>${p.capacity}${p.capacityUnit || 'W'}</td>
                  <td>
                    <input type="number" class="form-input" step="0.01" value="${p.pricePerWatt || ''}"
                      data-field="pricePerWatt" data-id="${p.id}" style="max-width: 120px; min-height: 34px;" />
                  </td>
                  <td>
                    <input type="number" class="form-input" value="${p.unitPrice}"
                      data-field="unitPrice" data-id="${p.id}" style="max-width: 150px; min-height: 34px;" />
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Inverter Rates -->
      <div class="card card-elevated" style="margin-bottom: 2rem;">
        <div class="card-header">
          <h3 class="card-title">${createIcon('zap')} Inverter Rates</h3>
        </div>
        <div class="table-container">
          <table class="data-table" id="inverter-rates-table">
            <thead>
              <tr>
                <th>Brand</th>
                <th>Model</th>
                <th>Capacity</th>
                <th>Type</th>
                <th>Price (PKR)</th>
              </tr>
            </thead>
            <tbody>
              ${inverters.map(p => `
                <tr data-product-id="${p.id}">
                  <td><strong>${p.brand}</strong></td>
                  <td>${p.model || '-'}</td>
                  <td>${p.capacity}${p.capacityUnit || 'kW'}</td>
                  <td><span class="badge badge-category">${p.inverterType || 'ongrid'}</span></td>
                  <td>
                    <input type="number" class="form-input" value="${p.unitPrice}"
                      data-field="unitPrice" data-id="${p.id}" style="max-width: 160px; min-height: 34px;" />
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Battery Rates -->
      <div class="card card-elevated">
        <div class="card-header">
          <h3 class="card-title">${createIcon('battery')} Battery Rates</h3>
        </div>
        <div class="table-container">
          <table class="data-table" id="battery-rates-table">
            <thead>
              <tr>
                <th>Brand</th>
                <th>Model</th>
                <th>Capacity</th>
                <th>Price (PKR)</th>
              </tr>
            </thead>
            <tbody>
              ${batteries.map(p => `
                <tr data-product-id="${p.id}">
                  <td><strong>${p.brand}</strong></td>
                  <td>${p.model || '-'}</td>
                  <td>${p.capacity}${p.capacityUnit || 'kWh'}</td>
                  <td>
                    <input type="number" class="form-input" value="${p.unitPrice}"
                      data-field="unitPrice" data-id="${p.id}" style="max-width: 160px; min-height: 34px;" />
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#mobile-menu-btn')?.addEventListener('click', toggleMobileSidebar);

  // Auto-calc unit price from price-per-watt
  container.querySelectorAll('input[data-field="pricePerWatt"]').forEach(input => {
    input.addEventListener('input', () => {
      const ppw = parseFloat(input.value) || 0;
      const row = input.closest('tr');
      const id = input.dataset.id;
      const product = products.find(p => String(p.id) === id);
      if (product && product.capacity) {
        const unitPrice = Math.round(ppw * parseInt(product.capacity));
        const unitPriceInput = row.querySelector('input[data-field="unitPrice"]');
        if (unitPriceInput) unitPriceInput.value = unitPrice;
      }
    });
  });

  // Save all
  container.querySelector('#save-all-btn')?.addEventListener('click', async () => {
    const inputs = container.querySelectorAll('input[data-field][data-id]');
    const updates = {};

    inputs.forEach(input => {
      const id = input.dataset.id;
      const field = input.dataset.field;
      const value = parseFloat(input.value) || 0;

      if (!updates[id]) updates[id] = {};
      updates[id][field] = value;
    });

    try {
      for (const [id, data] of Object.entries(updates)) {
        await updateProduct(id, data);
      }
      toast.success(`Updated ${Object.keys(updates).length} products`);
    } catch (err) {
      toast.error('Failed to save: ' + err.message);
    }
  });
}
