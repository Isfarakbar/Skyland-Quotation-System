// ============================================
// SKYLAND ENERGY — Quotation Builder (Wizard)
// ============================================
import { getAllCustomers, addCustomer, getAllProducts, addQuotation, updateQuotation, getQuotation, getCustomer, getSetting } from '../db/database.js';
import { DEFAULT_TERMS } from '../db/seed-data.js';
import { formatCurrency, generateQuotationNumber, SYSTEM_TYPES, CATEGORY_LABELS, uid, getInitials, escapeHtml } from '../utils/helpers.js';

import { createIcon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { navigate } from '../router.js';
import { toggleMobileSidebar } from '../components/sidebar.js';
import { sendQuotationWhatsApp } from '../utils/whatsapp.js';

const DISCOS = ['LESCO', 'IESCO', 'FESCO', 'GEPCO', 'MEPCO', 'PESCO', 'HESCO', 'SEPCO', 'QESCO', 'TESCO', 'K-Electric', 'Other'];
const DEFAULT_PAYMENT_SCHEDULE = [
  { label: 'Advance with order', percent: 20 },
  { label: 'Equipment delivery / installation', percent: 70 },
  { label: 'Testing and commissioning', percent: 10 },
];
const DEFAULT_WARRANTY = {
  panels: 'As per manufacturer warranty',
  inverter: 'As per manufacturer warranty',
  battery: 'As per manufacturer warranty',
  workmanship: '1 year workmanship warranty',
};

let state = {
  step: 1,
  customerId: null,
  customerName: '',
  systemSize: '',
  systemType: 'ongrid',
  disco: '', sanctionedLoad: 0, meterPhase: 'unknown', roofType: 'rcc', monthlyUnits: 0, monthlyBill: 0,
  prosumerIncluded: false, siteSurveyStatus: 'required',
  quotationNumber: '',
  validityDays: 5,
  items: [],
  discount: 0,
  discountType: 'percent',
  taxLabel: 'Applicable taxes', taxRate: 0,
  exchangeRate: 285,
  installationDays: 7,
  paymentSchedule: DEFAULT_PAYMENT_SCHEDULE.map(item => ({ ...item })),
  warranty: { ...DEFAULT_WARRANTY },
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
        disco: q.disco || '', sanctionedLoad: q.sanctionedLoad || 0, meterPhase: q.meterPhase || 'unknown',
        roofType: q.roofType || 'rcc', monthlyUnits: q.monthlyUnits || 0, monthlyBill: q.monthlyBill || 0,
        prosumerIncluded: Boolean(q.prosumerIncluded), siteSurveyStatus: q.siteSurveyStatus || 'required',
        quotationNumber: q.quotationNumber || '',
        validityDays: q.validityDays || 5,
        items: q.items || [],
        discount: q.discount || 0,
        discountType: q.discountType === 'flat' ? 'fixed' : (q.discountType || 'percent'),
        taxLabel: q.taxLabel || 'Applicable taxes', taxRate: q.taxRate || 0,
        exchangeRate: q.exchangeRate || 285,
        installationDays: q.installationDays || 7,
        paymentSchedule: q.paymentSchedule?.length ? q.paymentSchedule.map(item => ({ label: item.label, percent: item.percent })) : DEFAULT_PAYMENT_SCHEDULE.map(item => ({ ...item })),
        warranty: { ...DEFAULT_WARRANTY, ...(q.warranty || {}) },
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
    disco: '', sanctionedLoad: 0, meterPhase: 'unknown', roofType: 'rcc', monthlyUnits: 0, monthlyBill: 0,
    prosumerIncluded: false, siteSurveyStatus: 'required',
    quotationNumber: '',
    validityDays: 5,
    items: [],
    discount: 0,
    discountType: 'percent',
    taxLabel: 'Applicable taxes', taxRate: 0,
    exchangeRate: 285,
    installationDays: 7,
    paymentSchedule: DEFAULT_PAYMENT_SCHEDULE.map(item => ({ ...item })),
    warranty: { ...DEFAULT_WARRANTY },
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
        { n: 2, label: 'Project' },
        { n: 3, label: 'Scope' },
        { n: 4, label: 'Commercials' },
        { n: 5, label: 'Proposal' },
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
    <div style="max-width: 820px; margin: 0 auto;">
      <h2 style="margin-bottom: 0.35rem;">Project Profile</h2>
      <p class="text-sm text-secondary" style="margin-bottom: 1.5rem;">Capture the site and connection details required for an accurate Pakistan solar proposal.</p>

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

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Distribution Company (DISCO)</label>
            <select class="form-select" id="disco"><option value="">Select DISCO</option>${DISCOS.map(name => `<option value="${name}" ${state.disco === name ? 'selected' : ''}>${name}</option>`).join('')}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Sanctioned Load (kW)</label>
            <input type="number" class="form-input" id="sanctioned-load" value="${state.sanctionedLoad || ''}" min="0" step="0.1" placeholder="From electricity bill" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group"><label class="form-label">Meter Phase</label><select class="form-select" id="meter-phase"><option value="unknown" ${state.meterPhase === 'unknown' ? 'selected' : ''}>Not confirmed</option><option value="single-phase" ${state.meterPhase === 'single-phase' ? 'selected' : ''}>Single phase</option><option value="three-phase" ${state.meterPhase === 'three-phase' ? 'selected' : ''}>Three phase</option></select></div>
          <div class="form-group"><label class="form-label">Installation Surface</label><select class="form-select" id="roof-type"><option value="rcc" ${state.roofType === 'rcc' ? 'selected' : ''}>RCC rooftop</option><option value="metal-shed" ${state.roofType === 'metal-shed' ? 'selected' : ''}>Metal shed</option><option value="ground-mount" ${state.roofType === 'ground-mount' ? 'selected' : ''}>Ground mount</option><option value="other" ${state.roofType === 'other' ? 'selected' : ''}>Other</option></select></div>
        </div>

        <div class="form-row">
          <div class="form-group"><label class="form-label">Average Monthly Units (kWh)</label><input type="number" class="form-input" id="monthly-units" value="${state.monthlyUnits || ''}" min="0" placeholder="Optional" /></div>
          <div class="form-group"><label class="form-label">Average Monthly Bill (PKR)</label><input type="number" class="form-input" id="monthly-bill" value="${state.monthlyBill || ''}" min="0" placeholder="Optional" /></div>
        </div>

        <div class="form-row">
          <div class="form-group"><label class="form-label">Site Survey</label><select class="form-select" id="site-survey"><option value="required" ${state.siteSurveyStatus === 'required' ? 'selected' : ''}>Required before finalization</option><option value="completed" ${state.siteSurveyStatus === 'completed' ? 'selected' : ''}>Completed</option><option value="not-required" ${state.siteSurveyStatus === 'not-required' ? 'selected' : ''}>Not required</option></select></div>
          <label class="card" style="display:flex; align-items:center; gap:0.75rem; padding:1rem; cursor:pointer;"><input type="checkbox" id="prosumer-included" ${state.prosumerIncluded ? 'checked' : ''} /><span><strong>Include prosumer / DISCO coordination</strong><br><span class="text-xs text-secondary">Documentation and application coordination; approval remains subject to DISCO/NEPRA requirements.</span></span></label>
        </div>
      </div>
    </div>

    <div class="wizard-footer" style="margin-top: 2rem;">
      <button class="btn btn-secondary" id="prev-btn">${createIcon('arrow-left')} Back</button>
      <button class="btn btn-primary" id="next-btn">Next: Equipment & Scope ${createIcon('arrow-right')}</button>
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
    state.disco = document.getElementById('disco').value;
    state.sanctionedLoad = Number(document.getElementById('sanctioned-load').value) || 0;
    state.meterPhase = document.getElementById('meter-phase').value;
    state.roofType = document.getElementById('roof-type').value;
    state.monthlyUnits = Number(document.getElementById('monthly-units').value) || 0;
    state.monthlyBill = Number(document.getElementById('monthly-bill').value) || 0;
    state.siteSurveyStatus = document.getElementById('site-survey').value;
    state.prosumerIncluded = document.getElementById('prosumer-included').checked;

    if (!state.systemSize) {
      toast.warning('Please enter system size');
      return;
    }
    if (state.prosumerIncluded && state.sanctionedLoad > 0 && Number(state.systemSize) > state.sanctionedLoad) {
      toast.warning('Prosumer generation capacity cannot exceed the sanctioned load. Adjust the size or scope.');
      return;
    }
    if (state.prosumerIncluded && Number(state.systemSize) >= 250) {
      toast.info('A load-flow study may be required for a 250 kW or larger prosumer project.');
    }

    state.step = 3;
    renderStep();
  });
}

// ---- Step 3: Product selection ----
async function renderStep3(body) {
  const products = await getAllProducts();

  function calcSubtotal() {
    return state.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }

  function getProductDisplayName(product) {
    const baseName = String(product.name || '').trim();
    const existingText = baseName.toLowerCase();
    const details = [product.brand, product.model]
      .filter(value => value && !existingText.includes(String(value).toLowerCase()));
    const capacity = product.capacity ? `${product.capacity}${product.capacityUnit || ''}` : '';
    if (capacity && !existingText.includes(capacity.toLowerCase())) details.push(capacity);
    return [baseName, ...details].filter(Boolean).join(' · ');
  }

  function renderItems() {
    body.innerHTML = `
      <div class="quotation-products-step">
        <div class="quotation-products-heading">
          <div>
            <h2>Select Products & Services</h2>
            <p class="text-sm text-secondary">Add any combination of panels, inverters, batteries, accessories, or services. This is a price catalog—not stock tracking.</p>
          </div>
        </div>

        <div class="quotation-product-actions" aria-label="Add quotation item">
          <button class="btn btn-primary btn-sm" id="add-installation-scope">${createIcon('check')} Add Standard Installation Scope</button>
          <button class="btn btn-outline btn-sm" data-add-category="solar-panel">${createIcon('solar-panel')} Add Panel</button>
          <button class="btn btn-outline btn-sm" data-add-category="inverter">${createIcon('zap')} Add Inverter</button>
          <button class="btn btn-outline btn-sm" data-add-category="battery">${createIcon('battery')} Add Battery</button>
          <button class="btn btn-outline btn-sm" data-add-category="structure">${createIcon('package')} Add Structure</button>
          <button class="btn btn-outline btn-sm" data-add-category="cable">${createIcon('package')} Add Cable</button>
          <button class="btn btn-outline btn-sm" data-add-category="accessory">${createIcon('package')} Add Accessory</button>
          <button class="btn btn-outline btn-sm" data-add-category="service">${createIcon('plus')} Add Service</button>
          <button class="btn btn-outline btn-sm" data-add-category="other">${createIcon('plus')} Custom Item</button>
        </div>

        <div class="table-container" style="margin-bottom: 1rem;">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:30px;">#</th>
                <th>Quoted Item</th>
                <th style="width: 260px;">Catalog Product</th>
                <th style="width:80px;">Qty</th>
                <th style="width:130px;">Unit Price</th>
                <th style="width:130px;">Total</th>
                <th style="width:40px;"></th>
              </tr>
            </thead>
            <tbody>
              ${state.items.length === 0 ? `
                <tr><td colspan="7"><div class="quotation-products-empty">Choose a product type above to begin the quotation.</div></td></tr>
              ` : state.items.map((item, i) => `
                <tr data-idx="${i}">
                  <td class="text-secondary">${i + 1}</td>
                  <td class="quotation-item-name-cell">
                    <input type="text" class="form-input" value="${escapeHtml(item.name)}" data-field="name" style="font-size: 0.8rem; min-height: 34px;" />
                    <span class="badge badge-category">${escapeHtml(CATEGORY_LABELS[item.category] || item.category || 'Custom')}</span>
                  </td>
                  <td>
                    <select class="form-select" data-field="productSelect" style="font-size: 0.8rem; min-height: 34px;">
                      <option value="">${['service', 'other'].includes(item.category) ? 'Custom item (or select from catalog)' : '— Select exact product —'}</option>
                      ${products
                        .filter(p => !item.category || p.category === item.category)
                        .map(p => `<option value="${escapeHtml(p.id)}" ${String(item.productId) === String(p.id) ? 'selected' : ''}>${escapeHtml(getProductDisplayName(p))} — ${formatCurrency(p.unitPrice)}</option>`)
                        .join('')}
                    </select>
                  </td>
                  <td>
                    <input type="number" class="form-input" value="${item.quantity}" data-field="quantity" min="0" step="1" style="text-align:center; min-height: 34px;" />
                  </td>
                  <td>
                    <input type="number" class="form-input" value="${item.unitPrice}" data-field="unitPrice" min="0" style="text-align:right; min-height: 34px;" />
                  </td>
                  <td class="quotation-line-total" style="text-align: right; font-weight: 600;">
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
                <td id="quotation-items-subtotal" style="text-align: right; font-weight: 700; font-size: 1rem; color: var(--color-accent);">${formatCurrency(calcSubtotal())}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div class="wizard-footer" style="margin-top: 2rem;">
        <button class="btn btn-secondary" id="prev-btn">${createIcon('arrow-left')} Back</button>
        <button class="btn btn-primary" id="next-btn">Next: Discount & Terms ${createIcon('arrow-right')}</button>
      </div>
    `;

    body.querySelectorAll('select[data-field="productSelect"]').forEach(input => {
      input.addEventListener('change', () => {
        const row = input.closest('tr');
        const idx = parseInt(row.dataset.idx);
        const product = products.find(p => String(p.id) === input.value);
        if (product) {
          state.items[idx] = {
            ...state.items[idx],
            productId: product.id,
            name: getProductDisplayName(product),
            category: product.category,
            unit: product.unit || 'piece',
            unitPrice: Number(product.unitPrice) || 0,
          };

          if (product.category === 'solar-panel' && state.systemSize) {
            const capacity = Number.parseFloat(product.capacity) || 0;
            const wattage = product.capacityUnit === 'kW' ? capacity * 1000 : capacity;
            if (wattage > 0) state.items[idx].quantity = Math.ceil((Number(state.systemSize) * 1000) / wattage);
          }
          renderItems();
        }
      });
    });

    body.querySelectorAll('input[data-field]').forEach(input => {
      input.addEventListener('input', () => {
        const row = input.closest('tr');
        const idx = parseInt(row.dataset.idx);
        const field = input.dataset.field;
        state.items[idx][field] = field === 'name' ? input.value : (Number(input.value) || 0);
        row.querySelector('.quotation-line-total').textContent = formatCurrency(Number(state.items[idx].quantity) * Number(state.items[idx].unitPrice));
        body.querySelector('#quotation-items-subtotal').textContent = formatCurrency(calcSubtotal());
      });
    });

    // Remove item
    body.querySelectorAll('[data-action="remove"]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.items.splice(parseInt(btn.dataset.idx), 1);
        renderItems();
      });
    });

    body.querySelectorAll('[data-add-category]').forEach(button => button.addEventListener('click', () => {
      const category = button.dataset.addCategory;
      state.items.push({
        id: uid(),
        productId: '',
        name: ['service', 'other'].includes(category) ? (category === 'service' ? 'Custom service' : 'Custom item') : '',
        description: '',
        category,
        unit: category === 'service' ? 'job' : 'piece',
        quantity: 1,
        unitPrice: 0,
      });
      renderItems();
    }));

    body.querySelector('#add-installation-scope')?.addEventListener('click', () => {
      const standardScope = [
        ['structure', 'Solar mounting structure, foundations and fasteners', 'job'],
        ['accessory', 'DC/AC protection, distribution boxes, breakers and isolators', 'job'],
        ['cable', 'PV DC cable, AC cable, conduits and cable accessories', 'job'],
        ['accessory', 'Earthing system and lightning protection', 'job'],
        ['service', 'Installation labour and electrical works', 'job'],
        ['service', 'Engineering, system design, testing and commissioning', 'job'],
        ['service', 'Transportation and site mobilization', 'job'],
        ...(state.prosumerIncluded ? [['service', 'Prosumer/DISCO documentation and application coordination', 'job']] : []),
      ];
      const existing = new Set(state.items.map(item => String(item.name || '').toLowerCase()));
      standardScope.forEach(([category, name, unit]) => {
        if (!existing.has(name.toLowerCase())) state.items.push({ id: uid(), productId: '', name, description: '', category, unit, quantity: 1, unitPrice: 0 });
      });
      toast.success('Standard installation scope added. Enter rates or leave included items at zero.');
      renderItems();
    });

    body.querySelector('#prev-btn')?.addEventListener('click', () => { state.step = 2; renderStep(); });
    body.querySelector('#next-btn')?.addEventListener('click', () => {
      const validItems = state.items.filter(item => String(item.name || '').trim() && Number(item.quantity) > 0);
      if (!validItems.length || calcSubtotal() <= 0) {
        toast.warning('Add at least one priced product or service before continuing');
        return;
      }
      state.items = validItems;
      state.step = 4;
      renderStep();
    });
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

        <div class="form-row" style="margin-bottom: 1rem;">
          <div class="form-group">
            <label class="form-label">Tax Label</label>
            <input type="text" class="form-input" id="tax-label" value="${escapeHtml(state.taxLabel)}" maxlength="100" />
          </div>
          <div class="form-group">
            <label class="form-label">Tax Rate (%)</label>
            <input type="number" class="form-input" id="tax-rate" value="${state.taxRate}" min="0" max="100" step="0.01" />
            <span class="text-xs text-secondary">Keep at 0 when taxes are excluded or not yet confirmed.</span>
          </div>
        </div>

        <div id="pricing-summary" style="border-top: 1px solid var(--border-color); padding-top: 1rem;">
          ${renderPricingSummary(subtotal)}
        </div>
      </div>

      <div class="card" style="margin-bottom: 1.5rem; padding: 1.5rem;">
        <h3 style="margin-bottom:1rem;">Delivery & Payment Plan</h3>
        <div class="form-group" style="max-width:260px;"><label class="form-label">Estimated Installation (days)</label><input type="number" class="form-input" id="installation-days" value="${state.installationDays}" min="1" max="365" /></div>
        <div class="form-row">
          ${state.paymentSchedule.map((milestone, index) => `<div class="form-group"><label class="form-label">Milestone ${index + 1}</label><input class="form-input" data-payment-label="${index}" value="${escapeHtml(milestone.label)}" maxlength="120" /><div style="display:flex; align-items:center; gap:.5rem; margin-top:.4rem;"><input type="number" class="form-input" data-payment-percent="${index}" value="${milestone.percent}" min="0" max="100" /><span>%</span></div></div>`).join('')}
        </div>
        <p class="text-xs text-secondary">Payment milestone percentages must total 100%.</p>
      </div>

      <div class="card" style="margin-bottom: 1.5rem; padding: 1.5rem;">
        <h3 style="margin-bottom:1rem;">Warranty & After-Sales</h3>
        <div class="form-row"><div class="form-group"><label class="form-label">Solar Panels</label><input class="form-input" id="warranty-panels" value="${escapeHtml(state.warranty.panels)}" /></div><div class="form-group"><label class="form-label">Inverter</label><input class="form-input" id="warranty-inverter" value="${escapeHtml(state.warranty.inverter)}" /></div></div>
        <div class="form-row"><div class="form-group"><label class="form-label">Battery</label><input class="form-input" id="warranty-battery" value="${escapeHtml(state.warranty.battery)}" /></div><div class="form-group"><label class="form-label">Workmanship</label><input class="form-input" id="warranty-workmanship" value="${escapeHtml(state.warranty.workmanship)}" /></div></div>
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
  ['discount-value', 'discount-type', 'exchange-rate', 'tax-rate', 'tax-label'].forEach(id => {
    body.querySelector(`#${id}`)?.addEventListener('input', () => {
      state.discount = parseFloat(document.getElementById('discount-value').value) || 0;
      state.discountType = document.getElementById('discount-type').value;
      state.exchangeRate = parseFloat(document.getElementById('exchange-rate').value) || 285;
      state.taxRate = Math.min(100, Math.max(0, parseFloat(document.getElementById('tax-rate').value) || 0));
      state.taxLabel = document.getElementById('tax-label').value || 'Applicable taxes';
      document.getElementById('pricing-summary').innerHTML = renderPricingSummary(subtotal);
    });
  });

  body.querySelector('#prev-btn')?.addEventListener('click', () => { state.step = 3; renderStep(); });
  body.querySelector('#next-btn')?.addEventListener('click', () => {
    state.installationDays = Number(document.getElementById('installation-days').value) || 7;
    state.paymentSchedule = state.paymentSchedule.map((_, index) => ({
      label: document.querySelector(`[data-payment-label="${index}"]`).value.trim(),
      percent: Number(document.querySelector(`[data-payment-percent="${index}"]`).value) || 0,
    }));
    const paymentTotal = state.paymentSchedule.reduce((sum, milestone) => sum + milestone.percent, 0);
    if (state.paymentSchedule.some(milestone => !milestone.label) || Math.abs(paymentTotal - 100) > 0.01) {
      toast.warning('Payment milestone percentages must have labels and total exactly 100%');
      return;
    }
    state.warranty = {
      panels: document.getElementById('warranty-panels').value.trim(), inverter: document.getElementById('warranty-inverter').value.trim(),
      battery: document.getElementById('warranty-battery').value.trim(), workmanship: document.getElementById('warranty-workmanship').value.trim(),
    };
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
  const taxableAmount = Math.max(0, grandTotal);
  const taxAmount = taxableAmount * (state.taxRate / 100);
  const totalWithTax = taxableAmount + taxAmount;
  const perWatt = state.systemSize ? (totalWithTax / (parseFloat(state.systemSize) * 1000)) : 0;

  return `
    ${state.discount > 0 ? `
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
        <span class="text-secondary">Discount ${state.discountType === 'percent' ? `(${state.discount}%)` : ''}</span>
        <span style="color: var(--color-success);">- ${formatCurrency(discountAmount)}</span>
      </div>
    ` : ''}
    ${state.taxRate > 0 ? `<div style="display:flex; justify-content:space-between; margin-bottom:.5rem;"><span class="text-secondary">${escapeHtml(state.taxLabel)} (${state.taxRate}%)</span><span>${formatCurrency(taxAmount)}</span></div>` : ''}
    <div style="display: flex; justify-content: space-between; padding-top: 0.75rem; border-top: 2px solid var(--color-accent);">
      <span style="font-size: 1.1rem; font-weight: 700;">Grand Total</span>
      <span style="font-size: 1.3rem; font-weight: 800; color: var(--color-accent);">${formatCurrency(totalWithTax)}/-</span>
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
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = taxableAmount * (state.taxRate / 100);
  const grandTotal = taxableAmount + taxAmount;
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
          TECHNICAL & COMMERCIAL PROPOSAL
        </h2>

        <div style="margin-bottom: 1.5rem; line-height: 1.8;">
          <strong>${escapeHtml(customer?.name || 'Customer')}</strong><br>
          ${escapeHtml(customer?.city || '')}<br><br>
          Dear Valued Customer,<br>
          Thank you for considering Skyland Energy. We are pleased to submit this technical and commercial proposal based on the information currently available. Final engineering is subject to site verification.
        </div>

        <div style="background:#f3f7fb; border-left:4px solid #073d72; padding:12px 16px; margin-bottom:1.5rem;">
          <strong style="color:#073d72;">Project Summary</strong>
          <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px 24px; margin-top:8px; font-size:.8rem;">
            <div>System: <strong>${escapeHtml(state.systemSize)} kW ${escapeHtml(systemLabel)}</strong></div><div>DISCO: <strong>${escapeHtml(state.disco || 'To be confirmed')}</strong></div>
            <div>Sanctioned load: <strong>${state.sanctionedLoad ? `${state.sanctionedLoad} kW` : 'To be confirmed'}</strong></div><div>Meter: <strong>${escapeHtml(state.meterPhase.replace('-', ' '))}</strong></div>
            <div>Installation: <strong>${escapeHtml(state.roofType.replaceAll('-', ' '))}</strong></div><div>Site survey: <strong>${escapeHtml(state.siteSurveyStatus.replace('-', ' '))}</strong></div>
            <div>Monthly usage: <strong>${state.monthlyUnits ? `${state.monthlyUnits} kWh` : 'Not provided'}</strong></div><div>Prosumer coordination: <strong>${state.prosumerIncluded ? 'Included' : 'Excluded'}</strong></div>
          </div>
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
            ${taxAmount > 0 ? `<tr><td colspan="3" style="padding:8px 12px; text-align:right;">${escapeHtml(state.taxLabel)} (${state.taxRate}%)</td><td style="padding:8px 12px; text-align:right;">${formatCurrency(taxAmount).replace('PKR ', '')}</td></tr>` : ''}
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

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; margin:1.5rem 0; font-size:.82rem;">
          <div><h3 style="color:#073d72; margin-bottom:.5rem;">Delivery & Payment</h3><p>Estimated installation: ${state.installationDays} days after advance, site readiness and equipment availability.</p><ul style="padding-left:1.1rem; line-height:1.65;">${state.paymentSchedule.map(item => `<li>${escapeHtml(item.label)}: <strong>${item.percent}%</strong></li>`).join('')}</ul></div>
          <div><h3 style="color:#073d72; margin-bottom:.5rem;">Warranty & After-Sales</h3><ul style="padding-left:1.1rem; line-height:1.65;"><li>Panels: ${escapeHtml(state.warranty.panels)}</li><li>Inverter: ${escapeHtml(state.warranty.inverter)}</li><li>Battery: ${escapeHtml(state.warranty.battery)}</li><li>Workmanship: ${escapeHtml(state.warranty.workmanship)}</li></ul></div>
        </div>

        <div style="background:#fff7ed; border:1px solid #fed7aa; padding:10px 12px; margin-bottom:1.25rem; font-size:.78rem; line-height:1.55;"><strong>Pakistan regulatory note:</strong> Any prosumer connection remains subject to the applicable NEPRA regulations, sanctioned-load limits, DISCO feasibility, transformer capacity, inspection and required fees. Coordination is included only when stated above; approval is not guaranteed by this quotation.</div>

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
      disco: state.disco,
      sanctionedLoad: state.sanctionedLoad,
      meterPhase: state.meterPhase,
      roofType: state.roofType,
      monthlyUnits: state.monthlyUnits,
      monthlyBill: state.monthlyBill,
      prosumerIncluded: state.prosumerIncluded,
      siteSurveyStatus: state.siteSurveyStatus,
      items: state.items,
      subtotal,
      discount: state.discount,
      discountType: state.discountType,
      taxLabel: state.taxLabel,
      taxRate: state.taxRate,
      taxAmount,
      grandTotal,
      exchangeRate: state.exchangeRate,
      termsAndConditions: state.terms,
      validityDays: state.validityDays,
      notes: state.notes,
      installationDays: state.installationDays,
      paymentSchedule: state.paymentSchedule,
      warranty: state.warranty,
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
