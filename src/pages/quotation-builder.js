// ============================================
// SKYLAND ENERGY — Quotation Builder (Wizard)
// ============================================
import { getAllCustomers, addCustomer, getAllProducts, addQuotation, updateQuotation, getQuotation, getCustomer, getSetting } from '../db/database.js';
import { BOQ_TEMPLATE, DEFAULT_TERMS } from '../db/seed-data.js';
import { formatCurrency, generateQuotationNumber, SYSTEM_TYPES, uid, getInitials, escapeHtml } from '../utils/helpers.js';

import { createIcon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { navigate } from '../router.js';
import { toggleMobileSidebar } from '../components/sidebar.js';
import { sendQuotationWhatsApp } from '../utils/whatsapp.js';

let state = {
  step: 1,
  customerId: null,
  customerName: '',
  systemSize: '',
  systemType: 'ongrid',
  quotationNumber: '',
  validityDays: 5,
  items: [],
  discount: 0,
  discountType: 'percent',
  exchangeRate: 285,
  terms: [],
  notes: '',
  editingId: null,
};

export async function renderQuotationBuilder(params) {
  // Check if editing an existing quotation
  if (params && !params.startsWith('customer-')) {
    const q = await getQuotation(params);
    if (q) {
      const customer = await getCustomer(q.customerId);
      state = {
        step: 3,
        customerId: q.customerId,
        customerName: customer?.name || '',
        systemSize: q.systemSize || '',
        systemType: q.systemType || 'ongrid',
        quotationNumber: q.quotationNumber || '',
        validityDays: q.validityDays || 5,
        items: q.items || [],
        discount: q.discount || 0,
        discountType: q.discountType === 'flat' ? 'fixed' : (q.discountType || 'percent'),
        exchangeRate: q.exchangeRate || 285,
        terms: q.termsAndConditions || DEFAULT_TERMS,
        notes: q.notes || '',
        editingId: q.id,
      };
    }
  } else if (params && params.startsWith('customer-')) {
    // Pre-select customer
    const custId = params.replace('customer-', '');
    const customer = await getCustomer(custId);
    if (customer) {
      resetState();
      state.customerId = custId;
      state.customerName = customer.name;
      state.step = 2;
    }
  } else if (!params || !state.editingId) {
    // Fresh quotation — check if there's a customer id passed
    if (params && !isNaN(parseInt(params))) {
      // Could be a customer pre-select from customer page
      const customer = await getCustomer(parseInt(params));
      if (customer) {
        resetState();
        state.customerId = customer.id;
        state.customerName = customer.name;
        state.quotationNumber = generateQuotationNumber(customer.name);
        state.step = 2;
      }
    } else {
      resetState();
    }
  }

  renderStep();
}

function resetState() {
  state = {
    step: 1,
    customerId: null,
    customerName: '',
    systemSize: '',
    systemType: 'ongrid',
    quotationNumber: '',
    validityDays: 5,
    items: [],
    discount: 0,
    discountType: 'percent',
    exchangeRate: 285,
    terms: [...DEFAULT_TERMS],
    notes: '',
    editingId: null,
  };
}

function renderStep() {
  const container = document.getElementById('page-content');

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <button class="mobile-menu-toggle" id="mobile-menu-btn">${createIcon('menu')}</button>
        <div>
          <h1 class="page-title">${state.editingId ? 'Edit Quotation' : 'New Quotation'}</h1>
          <p class="page-subtitle">${escapeHtml(state.quotationNumber || 'Build a quotation step by step')}</p>
        </div>
      </div>
    </div>

    <!-- Wizard Steps -->
    <div class="wizard-steps">
      ${[
        { n: 1, label: 'Customer' },
        { n: 2, label: 'System' },
        { n: 3, label: 'Line Items' },
        { n: 4, label: 'Pricing' },
        { n: 5, label: 'Preview' },
      ].map((s, i, arr) => `
        <div class="wizard-step ${state.step === s.n ? 'active' : ''} ${state.step > s.n ? 'completed' : ''}" data-step="${s.n}">
          <span class="wizard-step-number">${state.step > s.n ? createIcon('check') : s.n}</span>
          <span>${s.label}</span>
        </div>
        ${i < arr.length - 1 ? `<div class="wizard-step-connector ${state.step > s.n ? 'completed' : ''}"></div>` : ''}
      `).join('')}
    </div>

    <div class="wizard-body" id="wizard-body"></div>
  `;

  container.querySelector('#mobile-menu-btn')?.addEventListener('click', toggleMobileSidebar);

  // Step click navigation
  container.querySelectorAll('.wizard-step').forEach(el => {
    el.addEventListener('click', () => {
      const n = parseInt(el.dataset.step);
      if (n < state.step) {
        state.step = n;
        renderStep();
      }
    });
  });

  const body = document.getElementById('wizard-body');
  switch (state.step) {
    case 1: renderStep1(body); break;
    case 2: renderStep2(body); break;
    case 3: renderStep3(body); break;
    case 4: renderStep4(body); break;
    case 5: renderStep5(body); break;
  }
}

// ---- Step 1: Customer Selection ----
async function renderStep1(body) {
  const customers = await getAllCustomers();

  body.innerHTML = `
    <div style="max-width: 600px; margin: 0 auto;">
      <h2 style="margin-bottom: 1.5rem;">Select Customer</h2>

      <div class="search-input-wrapper" style="max-width: 100%; margin-bottom: 1.5rem;">
        ${createIcon('search')}
        <input type="text" class="search-input" placeholder="Search customers..." id="cust-search" />
      </div>

      <div id="customer-list" style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 400px; overflow-y: auto;">
        ${customers.map(c => `
          <div class="card ${state.customerId === c.id ? 'selected-customer' : ''}" style="cursor: pointer; padding: 1rem; ${state.customerId === c.id ? 'border-color: var(--color-accent); background: rgba(250,76,10,0.06);' : ''}" data-cust-id="${escapeHtml(c.id)}">
            <div class="customer-name-cell">
              <div class="customer-avatar">${escapeHtml(getInitials(c.name))}</div>
              <div>
                <strong>${escapeHtml(c.name)}</strong>
                <div class="text-sm text-secondary">${escapeHtml(c.phone)} • ${escapeHtml(c.city)}</div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      ${customers.length === 0 ? `
        <div class="empty-state" style="padding: 2rem;">
          <p class="text-secondary">No customers yet.</p>
        </div>
      ` : ''}

      <div style="margin-top: 1rem; text-align: center;">
        <button class="btn btn-outline" id="quick-add-customer">
          ${createIcon('plus')} Quick Add Customer
        </button>
      </div>
    </div>

    <div class="wizard-footer" style="margin-top: 2rem;">
      <div></div>
      <button class="btn btn-primary" id="next-btn" ${!state.customerId ? 'disabled' : ''}>
        Next: System Configuration ${createIcon('arrow-right')}
      </button>
    </div>
  `;

  // Customer selection
  body.querySelectorAll('[data-cust-id]').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.custId;
      const cust = customers.find(c => String(c.id) === id);
      state.customerId = id;
      state.customerName = cust.name;
      state.quotationNumber = generateQuotationNumber(cust.name);

      body.querySelectorAll('[data-cust-id]').forEach(c => {
        c.style.borderColor = '';
        c.style.background = '';
      });
      card.style.borderColor = 'var(--color-accent)';
      card.style.background = 'rgba(250,76,10,0.06)';
      body.querySelector('#next-btn').disabled = false;
    });
  });

  // Search
  body.querySelector('#cust-search')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    body.querySelectorAll('[data-cust-id]').forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(q) ? '' : 'none';
    });
  });

  // Quick add
  body.querySelector('#quick-add-customer')?.addEventListener('click', async () => {
    const { openCustomerForm } = await import('./customers.js');
    openCustomerForm();
  });

  // Next
  body.querySelector('#next-btn')?.addEventListener('click', () => {
    if (!state.customerId) return;
    state.step = 2;
    renderStep();
  });
}

// ---- Step 2: System Configuration ----
async function renderStep2(body) {
  body.innerHTML = `
    <div style="max-width: 600px; margin: 0 auto;">
      <h2 style="margin-bottom: 1.5rem;">System Configuration</h2>

      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <div class="form-group">
          <label class="form-label">System Size (KW) <span class="required">*</span></label>
          <input type="number" class="form-input" id="system-size" value="${state.systemSize}" placeholder="e.g., 25" step="0.1" required />
        </div>

        <div class="form-group">
          <label class="form-label">System Type</label>
          <div style="display: flex; gap: 1rem;">
            ${Object.entries(SYSTEM_TYPES).map(([key, label]) => `
              <label class="card" style="flex: 1; padding: 1rem; cursor: pointer; text-align: center; ${state.systemType === key ? 'border-color: var(--color-accent); background: rgba(250,76,10,0.06);' : ''}">
                <input type="radio" name="system-type" value="${key}" ${state.systemType === key ? 'checked' : ''} style="display: none;" />
                <div style="font-weight: 600; margin-bottom: 0.25rem;">${label}</div>
                <div class="text-xs text-secondary">${key === 'ongrid' ? 'Grid-tied system' : key === 'hybrid' ? 'Grid + Battery' : 'Standalone'}</div>
              </label>
            `).join('')}
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Quotation Reference</label>
            <input type="text" class="form-input" id="quote-ref" value="${escapeHtml(state.quotationNumber)}" placeholder="Auto-generated" pattern="[A-Za-z0-9][A-Za-z0-9-]{2,79}" maxlength="80" />
          </div>
          <div class="form-group">
            <label class="form-label">Validity (Days)</label>
            <input type="number" class="form-input" id="validity-days" value="${state.validityDays}" min="1" max="90" />
          </div>
        </div>
      </div>
    </div>

    <div class="wizard-footer" style="margin-top: 2rem;">
      <button class="btn btn-secondary" id="prev-btn">${createIcon('arrow-left')} Back</button>
      <button class="btn btn-primary" id="next-btn">Next: Line Items ${createIcon('arrow-right')}</button>
    </div>
  `;

  // System type toggle
  body.querySelectorAll('input[name="system-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.systemType = e.target.value;
      body.querySelectorAll('input[name="system-type"]').forEach(r => {
        r.closest('.card').style.borderColor = r.checked ? 'var(--color-accent)' : '';
        r.closest('.card').style.background = r.checked ? 'rgba(250,76,10,0.06)' : '';
      });
    });
  });

  body.querySelector('#prev-btn')?.addEventListener('click', () => { state.step = 1; renderStep(); });
  body.querySelector('#next-btn')?.addEventListener('click', () => {
    state.systemSize = document.getElementById('system-size').value;
    state.quotationNumber = document.getElementById('quote-ref').value || generateQuotationNumber(state.customerName);
    state.validityDays = parseInt(document.getElementById('validity-days').value) || 5;

    if (!state.systemSize) {
      toast.warning('Please enter system size');
      return;
    }

    // Auto-populate items from BOQ template if empty
    if (state.items.length === 0) {
      state.items = BOQ_TEMPLATE.map(item => ({
        ...item,
        id: uid(),
        total: item.quantity * item.unitPrice,
      }));
    }

    state.step = 3;
    renderStep();
  });
}

// ---- Step 3: Line Items ----
async function renderStep3(body) {
  const products = await getAllProducts();

  function calcSubtotal() {
    return state.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }

  function renderItems() {
    body.innerHTML = `
      <div style="max-width: 900px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <h2>Bill of Quantities (BOQ)</h2>
          <button class="btn btn-outline btn-sm" id="add-item-btn">${createIcon('plus')} Add Item</button>
        </div>

        <div class="table-container" style="margin-bottom: 1rem;">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:30px;">#</th>
                <th>Item Details</th>
                <th style="width: 180px;">Product</th>
                <th style="width:80px;">Qty</th>
                <th style="width:130px;">Unit Price</th>
                <th style="width:130px;">Total</th>
                <th style="width:40px;"></th>
              </tr>
            </thead>
            <tbody>
              ${state.items.map((item, i) => `
                <tr data-idx="${i}">
                  <td class="text-secondary">${i + 1}</td>
                  <td>
                    <input type="text" class="form-input" value="${escapeHtml(item.name)}" data-field="name" style="font-size: 0.8rem; min-height: 34px;" />
                  </td>
                  <td>
                    <select class="form-select" data-field="productSelect" style="font-size: 0.8rem; min-height: 34px;">
                      <option value="">— Pick —</option>
                      ${products
                        .filter(p => !item.category || p.category === item.category || item.category === 'service')
                        .map(p => `<option value="${escapeHtml(p.id)}" ${item.productId === p.id ? 'selected' : ''}>${escapeHtml(p.brand)} ${escapeHtml(p.model || '')} — ${formatCurrency(p.unitPrice)}</option>`)
                        .join('')}
                    </select>
                  </td>
                  <td>
                    <input type="number" class="form-input" value="${item.quantity}" data-field="quantity" min="0" step="1" style="text-align:center; min-height: 34px;" />
                  </td>
                  <td>
                    <input type="number" class="form-input" value="${item.unitPrice}" data-field="unitPrice" min="0" style="text-align:right; min-height: 34px;" />
                  </td>
                  <td style="text-align: right; font-weight: 600;">
                    ${formatCurrency(item.quantity * item.unitPrice)}
                  </td>
                  <td>
                    <button class="btn btn-ghost btn-icon btn-sm" data-action="remove" data-idx="${i}" style="color: var(--color-danger-light);">
                      ${createIcon('x')}
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background: var(--bg-table-header);">
                <td colspan="5" style="text-align: right; font-weight: 700; font-size: 1rem;">Subtotal</td>
                <td style="text-align: right; font-weight: 700; font-size: 1rem; color: var(--color-accent);">${formatCurrency(calcSubtotal())}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div class="wizard-footer" style="margin-top: 2rem;">
        <button class="btn btn-secondary" id="prev-btn">${createIcon('arrow-left')} Back</button>
        <button class="btn btn-primary" id="next-btn">Next: Pricing ${createIcon('arrow-right')}</button>
      </div>
    `;

    // Field change handlers
    body.querySelectorAll('input[data-field], select[data-field]').forEach(input => {
      input.addEventListener('change', (e) => {
        const row = input.closest('tr');
        const idx = parseInt(row.dataset.idx);
        const field = input.dataset.field;

        if (field === 'productSelect') {
          const prodId = input.value;
          const product = products.find(p => String(p.id) === prodId);
          if (product) {
            state.items[idx].productId = product.id;
            state.items[idx].unitPrice = product.unitPrice;
            state.items[idx].name = product.name;

            // Auto-calc panel quantity based on system size
            if (product.category === 'solar-panel' && state.systemSize) {
              const wattage = parseInt(product.capacity) || 585;
              const sizeW = parseFloat(state.systemSize) * 1000;
              state.items[idx].quantity = Math.ceil(sizeW / wattage);
            }
            renderItems();
          }
        } else if (field === 'quantity') {
          state.items[idx].quantity = parseFloat(input.value) || 0;
          renderItems();
        } else if (field === 'unitPrice') {
          state.items[idx].unitPrice = parseFloat(input.value) || 0;
          renderItems();
        } else if (field === 'name') {
          state.items[idx].name = input.value;
        }
      });
    });

    // Remove item
    body.querySelectorAll('[data-action="remove"]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.items.splice(parseInt(btn.dataset.idx), 1);
        renderItems();
      });
    });

    // Add item
    body.querySelector('#add-item-btn')?.addEventListener('click', () => {
      state.items.push({
        id: uid(),
        name: '',
        description: '',
        category: '',
        unit: 'job',
        quantity: 1,
        unitPrice: 0,
      });
      renderItems();
    });

    body.querySelector('#prev-btn')?.addEventListener('click', () => { state.step = 2; renderStep(); });
    body.querySelector('#next-btn')?.addEventListener('click', () => { state.step = 4; renderStep(); });
  }

  renderItems();
}

// ---- Step 4: Pricing & Terms ----
async function renderStep4(body) {
  const subtotal = state.items.reduce((s, i) => s + (i.quantity * i.unitPrice), 0);
  const savedTerms = state.terms.length > 0 ? state.terms : DEFAULT_TERMS;

  body.innerHTML = `
    <div style="max-width: 700px; margin: 0 auto;">
      <h2 style="margin-bottom: 1.5rem;">Pricing & Terms</h2>

      <div class="card" style="margin-bottom: 1.5rem; padding: 1.5rem;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
          <span class="text-secondary">Subtotal</span>
          <strong>${formatCurrency(subtotal)}</strong>
        </div>

        <div class="form-row" style="margin-bottom: 1rem;">
          <div class="form-group">
            <label class="form-label">Discount</label>
            <div style="display: flex; gap: 0.5rem;">
              <input type="number" class="form-input" id="discount-value" value="${state.discount}" min="0" />
              <select class="form-select" id="discount-type" style="width: 80px;">
                <option value="percent" ${state.discountType === 'percent' ? 'selected' : ''}>%</option>
                <option value="fixed" ${state.discountType === 'fixed' ? 'selected' : ''}>PKR</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Exchange Rate (USD/PKR)</label>
            <input type="number" class="form-input" id="exchange-rate" value="${state.exchangeRate}" />
          </div>
        </div>

        <div id="pricing-summary" style="border-top: 1px solid var(--border-color); padding-top: 1rem;">
          ${renderPricingSummary(subtotal)}
        </div>
      </div>

      <div class="form-group" style="margin-bottom: 1.5rem;">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="quote-notes" placeholder="Any additional notes for this quotation...">${escapeHtml(state.notes)}</textarea>
      </div>

      <div class="form-group">
        <label class="form-label">Terms & Conditions</label>
        <textarea class="form-textarea" id="quote-terms" style="min-height: 200px; font-size: 0.8rem;">${savedTerms.map((t, i) => `${i + 1}. ${t}`).join('\n')}</textarea>
      </div>
    </div>

    <div class="wizard-footer" style="margin-top: 2rem;">
      <button class="btn btn-secondary" id="prev-btn">${createIcon('arrow-left')} Back</button>
      <button class="btn btn-primary" id="next-btn">Preview & Save ${createIcon('arrow-right')}</button>
    </div>
  `;

  // Live pricing update
  ['discount-value', 'discount-type', 'exchange-rate'].forEach(id => {
    body.querySelector(`#${id}`)?.addEventListener('input', () => {
      state.discount = parseFloat(document.getElementById('discount-value').value) || 0;
      state.discountType = document.getElementById('discount-type').value;
      state.exchangeRate = parseFloat(document.getElementById('exchange-rate').value) || 285;
      document.getElementById('pricing-summary').innerHTML = renderPricingSummary(subtotal);
    });
  });

  body.querySelector('#prev-btn')?.addEventListener('click', () => { state.step = 3; renderStep(); });
  body.querySelector('#next-btn')?.addEventListener('click', () => {
    state.notes = document.getElementById('quote-notes').value;
    const termsText = document.getElementById('quote-terms').value;
    state.terms = termsText.split('\n').map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
    state.step = 5;
    renderStep();
  });
}

function renderPricingSummary(subtotal) {
  let discountAmount = 0;
  if (state.discountType === 'percent') {
    discountAmount = subtotal * (state.discount / 100);
  } else {
    discountAmount = state.discount;
  }
  const grandTotal = subtotal - discountAmount;
  const perWatt = state.systemSize ? (grandTotal / (parseFloat(state.systemSize) * 1000)) : 0;

  return `
    ${state.discount > 0 ? `
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
        <span class="text-secondary">Discount ${state.discountType === 'percent' ? `(${state.discount}%)` : ''}</span>
        <span style="color: var(--color-success);">- ${formatCurrency(discountAmount)}</span>
      </div>
    ` : ''}
    <div style="display: flex; justify-content: space-between; padding-top: 0.75rem; border-top: 2px solid var(--color-accent);">
      <span style="font-size: 1.1rem; font-weight: 700;">Grand Total</span>
      <span style="font-size: 1.3rem; font-weight: 800; color: var(--color-accent);">${formatCurrency(grandTotal)}/-</span>
    </div>
    ${state.systemSize ? `
      <div style="display: flex; justify-content: space-between; margin-top: 0.5rem;">
        <span class="text-sm text-secondary">Per Watt Price</span>
        <span class="text-sm font-semibold">PKR ${perWatt.toFixed(2)}/W</span>
      </div>
    ` : ''}
  `;
}

// ---- Step 5: Preview & Actions ----
async function renderStep5(body) {
  const customer = await getCustomer(state.customerId);
  const subtotal = state.items.reduce((s, i) => s + (i.quantity * i.unitPrice), 0);
  let discountAmount = state.discountType === 'percent' ? subtotal * (state.discount / 100) : state.discount;
  const grandTotal = subtotal - discountAmount;
  const systemLabel = SYSTEM_TYPES[state.systemType] || 'On-Grid';
  const [companyName, companyAddress, companyPhone, companyWhatsapp, companyEmail, companyWebsite, companyTagline, companyCredentials] = await Promise.all([
    getSetting('companyName'), getSetting('companyAddress'), getSetting('companyPhone'), getSetting('companyWhatsapp'),
    getSetting('companyEmail'), getSetting('companyWebsite'), getSetting('companyTagline'), getSetting('companyCredentials'),
  ]);
  const company = {
    name: companyName || 'Skyland Energy (Pvt.) Ltd',
    address: companyAddress || '286 H-1, Johar Town, Lahore, Pakistan',
    phone: companyPhone || '+92 42 32353019',
    whatsapp: companyWhatsapp || '+92 310 8134361',
    email: companyEmail || 'info@theskylandenergy.com',
    website: companyWebsite || 'https://www.theskylandenergy.com',
    tagline: companyTagline || 'Your Energy Management Company',
    credentials: companyCredentials || 'AEDB & PEC Approved',
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  body.innerHTML = `
    <div style="max-width: 850px; margin: 0 auto;">
      <!-- Action Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <h2>Quotation Preview</h2>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button class="btn btn-secondary" id="save-draft-btn">
            ${createIcon('save')} Save Draft
          </button>
          <button class="btn btn-outline" id="download-pdf-btn">
            ${createIcon('download')} Download PDF
          </button>
          <button class="btn btn-whatsapp" id="send-whatsapp-btn">
            ${createIcon('whatsapp')} Send WhatsApp
          </button>
          <button class="btn btn-success" id="save-sent-btn">
            ${createIcon('check')} Save & Mark Sent
          </button>
        </div>
      </div>

      <!-- Preview Document -->
      <div class="quotation-preview" id="quotation-preview">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem;">
          <div>
            <img src="/Skyland Recreated Logo.svg" alt="Skyland Energy" style="height: 60px;" />
            <div style="margin-top: 6px; color: #073d72; font-size: 0.72rem; font-weight: 700;">${escapeHtml(company.tagline)} · ${escapeHtml(company.credentials)}</div>
          </div>
          <div style="text-align: right; color: #555; font-size: 0.75rem; line-height: 1.55; max-width: 310px;">
            <strong style="color: #073d72;">${escapeHtml(company.name)}</strong><br>
            ${escapeHtml(company.address)}<br>
            ${escapeHtml(company.phone)} · WhatsApp ${escapeHtml(company.whatsapp)}<br>
            ${escapeHtml(company.email)} · ${escapeHtml(company.website.replace(/^https?:\/\//, ''))}
            <div>${dateStr}</div>
            <div>Ref: ${escapeHtml(state.quotationNumber)}</div>
          </div>
        </div>

        <h2 style="font-size: 1.3rem; color: #073d72; margin-bottom: 1rem; text-align: center; border-bottom: 2px solid #073d72; padding-bottom: 0.5rem;">
          Solar Proposal
        </h2>

        <div style="margin-bottom: 1.5rem; line-height: 1.8;">
          <strong>${escapeHtml(customer?.name || 'Customer')}</strong><br>
          ${escapeHtml(customer?.city || '')}<br><br>
          Dear Valued Customer,<br>
          We are pleased to submit the requested solar proposal. Please contact our team with any questions or requested adjustments.
        </div>

        <h3 style="color: #073d72; margin-bottom: 1rem;">
          Quotation for ${escapeHtml(state.systemSize)}-KW ${escapeHtml(systemLabel)} Solar System:
        </h3>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem;">
          <thead>
            <tr style="background: #073d72; color: #fff;">
              <th style="padding: 8px 12px; text-align: left; font-size: 0.8rem;">Sr.#</th>
              <th style="padding: 8px 12px; text-align: left; font-size: 0.8rem;">Item Details</th>
              <th style="padding: 8px 12px; text-align: center; font-size: 0.8rem;">Quantity</th>
              <th style="padding: 8px 12px; text-align: right; font-size: 0.8rem;">Amounts</th>
            </tr>
          </thead>
          <tbody>
            ${state.items.filter(i => i.name).map((item, idx) => `
              <tr style="border-bottom: 1px solid #e5e7eb; ${idx % 2 === 1 ? 'background: #f9fafb;' : ''}">
                <td style="padding: 8px 12px; color: #666;">${idx + 1}</td>
                <td style="padding: 8px 12px;">${escapeHtml(item.name)}</td>
                <td style="padding: 8px 12px; text-align: center;">${item.quantity || '-'}</td>
                <td style="padding: 8px 12px; text-align: right; font-weight: 500;">${formatCurrency(item.quantity * item.unitPrice).replace('PKR ', '')}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            ${discountAmount > 0 ? `
              <tr style="border-top: 2px solid #073d72;">
                <td colspan="3" style="padding: 8px 12px; text-align: right; font-weight: 600;">Subtotal</td>
                <td style="padding: 8px 12px; text-align: right; font-weight: 600;">${formatCurrency(subtotal).replace('PKR ', '')}</td>
              </tr>
              <tr>
                <td colspan="3" style="padding: 8px 12px; text-align: right; color: #16a34a;">Discount</td>
                <td style="padding: 8px 12px; text-align: right; color: #16a34a;">- ${formatCurrency(discountAmount).replace('PKR ', '')}</td>
              </tr>
            ` : ''}
            <tr style="background: #073d72; color: #fff;">
              <td colspan="3" style="padding: 10px 12px; text-align: right; font-weight: 700; font-size: 1rem;">Total</td>
              <td style="padding: 10px 12px; text-align: right; font-weight: 700; font-size: 1rem;">${formatCurrency(grandTotal).replace('PKR ', '')}/-</td>
            </tr>
          </tfoot>
        </table>

        ${state.notes ? `
          <div style="margin-bottom: 1rem; font-style: italic; color: #666;">
            Note: ${escapeHtml(state.notes)}
          </div>
        ` : `
          <div style="margin-bottom: 1rem; font-style: italic; color: #666;">
            Note: Per watt price will remain the same in case of increase or decrease in the installed capacity up to 5%.
          </div>
        `}

        <h3 style="color: #073d72; margin-bottom: 0.75rem;">Terms & Conditions:</h3>
        <ol style="padding-left: 1.25rem; color: #555; font-size: 0.85rem; line-height: 1.8;">
          ${(state.terms.length > 0 ? state.terms : DEFAULT_TERMS).map(t => `<li>${escapeHtml(t)}</li>`).join('')}
        </ol>

        <div style="margin-top: 3rem; display: flex; justify-content: space-between;">
          <div>
            <div style="margin-bottom: 0.5rem;"><strong>Thanks & Regards,</strong></div>
            <div style="margin-top: 2rem; border-top: 1px solid #999; padding-top: 0.5rem; width: 200px;">
              Sales Team<br>
              <strong>${escapeHtml(company.name)}</strong><br>
              <span style="font-size: 0.72rem; color: #666;">${escapeHtml(company.website.replace(/^https?:\/\//, ''))}</span>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="margin-bottom: 1rem;">Client's Name: _________________</div>
            <div style="margin-top: 2rem; border-top: 1px solid #999; padding-top: 0.5rem; width: 200px; margin-left: auto;">
              Signature<br>
              Date: _________________
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="wizard-footer" style="margin-top: 2rem;">
      <button class="btn btn-secondary" id="prev-btn">${createIcon('arrow-left')} Back to Pricing</button>
      <div></div>
    </div>
  `;

  body.querySelector('#prev-btn')?.addEventListener('click', () => { state.step = 4; renderStep(); });

  // Save handlers
  const saveQuotation = async (status) => {
    const data = {
      quotationNumber: state.quotationNumber,
      customerId: state.customerId,
      systemSize: parseFloat(state.systemSize),
      systemType: state.systemType,
      items: state.items,
      subtotal,
      discount: state.discount,
      discountType: state.discountType,
      grandTotal,
      exchangeRate: state.exchangeRate,
      termsAndConditions: state.terms,
      validityDays: state.validityDays,
      notes: state.notes,
      status,
    };

    try {
      if (state.editingId) {
        await updateQuotation(state.editingId, data);
        toast.success('Quotation updated!');
      } else {
        const id = await addQuotation(data);
        state.editingId = id;
        toast.success('Quotation saved!');
      }
      return true;
    } catch (err) {
      toast.error('Failed to save: ' + err.message);
      return false;
    }
  };

  body.querySelector('#save-draft-btn')?.addEventListener('click', async () => {
    if (await saveQuotation('draft')) navigate('/quotations');
  });

  body.querySelector('#save-sent-btn')?.addEventListener('click', async () => {
    if (await saveQuotation('sent')) navigate('/quotations');
  });

  body.querySelector('#download-pdf-btn')?.addEventListener('click', async () => {
    const { generateQuotationPDF } = await import('../utils/pdf-generator.js');
    await saveQuotation('draft');
    const el = document.getElementById('quotation-preview');
    generateQuotationPDF(el, state.quotationNumber);
  });

  body.querySelector('#send-whatsapp-btn')?.addEventListener('click', async () => {
    await saveQuotation('sent');
    if (customer) {
      sendQuotationWhatsApp(customer, {
        quotationNumber: state.quotationNumber,
        systemSize: state.systemSize,
        systemType: state.systemType,
        grandTotal,
        validityDays: state.validityDays,
      });
    }
  });
}
