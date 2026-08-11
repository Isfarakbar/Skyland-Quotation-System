// ============================================
// SKYLAND ENERGY — Quotations List Page
// ============================================
import { getAllQuotations, getAllCustomers, deleteQuotation, updateQuotation, getQuotation, getCustomer, getSetting, sendQuotationEmail } from '../db/database.js';
import { formatCurrency, formatDate, STATUS_CONFIG, SYSTEM_TYPES, matchesSearch, debounce, escapeHtml } from '../utils/helpers.js';
import { createIcon } from '../components/icons.js';
import { showConfirm } from '../components/confirm-dialog.js';
import { toast } from '../components/toast.js';
import { navigate } from '../router.js';
import { toggleMobileSidebar } from '../components/sidebar.js';
import { sendQuotationWhatsApp } from '../utils/whatsapp.js';
import { openModal, closeModal } from '../components/modal.js';
import { DEFAULT_TERMS } from '../db/seed-data.js';
import { hasRole } from '../auth.js';

let currentFilter = 'all';
let searchQuery = '';

export async function renderQuotations(params) {
  // If a specific quotation ID is passed, show the detail/preview
  if (params) {
    return showQuotationDetail(params);
  }

  const container = document.getElementById('page-content');
  const quotations = await getAllQuotations();
  const customers = await getAllCustomers();

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <button class="mobile-menu-toggle" id="mobile-menu-btn">${createIcon('menu')}</button>
        <div>
          <h1 class="page-title">Quotations</h1>
          <p class="page-subtitle">${quotations.length} total quotations</p>
        </div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-primary" id="new-quote-btn">
          ${createIcon('plus')} New Quotation
        </button>
      </div>
    </div>

    <div class="page-body">
      <div class="page-toolbar">
        <div class="page-toolbar-left">
          <div class="search-input-wrapper">
            ${createIcon('search')}
            <input type="text" class="search-input" placeholder="Search quotations..." id="quote-search" />
          </div>
          <div class="tab-filters">
            ${['all', 'draft', 'sent', 'accepted', 'rejected', 'expired'].map(s => `
              <button class="tab-filter ${currentFilter === s ? 'active' : ''}" data-filter="${s}">
                ${s === 'all' ? 'All' : STATUS_CONFIG[s]?.label || s}
              </button>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="card card-elevated" id="quotations-table-wrapper">
        ${renderQuotationTable(quotations, customers)}
      </div>
    </div>
  `;

  container.querySelector('#mobile-menu-btn')?.addEventListener('click', toggleMobileSidebar);
  container.querySelector('#new-quote-btn')?.addEventListener('click', () => navigate('/quotation-builder'));

  container.querySelector('#quote-search')?.addEventListener('input', debounce((e) => {
    searchQuery = e.target.value;
    refreshTable(quotations, customers);
  }, 200));

  container.querySelectorAll('.tab-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      container.querySelectorAll('.tab-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      refreshTable(quotations, customers);
    });
  });

  bindActions(container, quotations, customers);
}

function refreshTable(quotations, customers) {
  const wrapper = document.getElementById('quotations-table-wrapper');
  if (wrapper) {
    wrapper.innerHTML = renderQuotationTable(quotations, customers);
    bindActions(document.getElementById('page-content'), quotations, customers);
  }
}

function renderQuotationTable(quotations, customers) {
  let filtered = quotations;
  if (currentFilter !== 'all') {
    filtered = filtered.filter(q => q.status === currentFilter);
  }
  if (searchQuery) {
    filtered = filtered.filter(q => {
      const customer = customers.find(c => c.id === q.customerId);
      const searchable = {
        ...q,
        customerName: customer?.name || '',
      };
      return matchesSearch(searchable, searchQuery, ['quotationNumber', 'customerName']);
    });
  }

  if (filtered.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">${createIcon('file-text', 48)}</div>
        <h4 class="empty-state-title">No quotations found</h4>
        <p class="empty-state-text">${searchQuery || currentFilter !== 'all' ? 'Try different filters' : 'Create your first quotation'}</p>
      </div>
    `;
  }

  return `
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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(q => {
            const customer = customers.find(c => c.id === q.customerId);
            const status = STATUS_CONFIG[q.status] || STATUS_CONFIG.draft;
            return `
              <tr>
                <td><strong>${escapeHtml(q.quotationNumber || '-')}</strong></td>
                <td>${escapeHtml(customer?.name || 'Unknown')}</td>
                <td>${escapeHtml(q.systemSize || '-')} KW ${escapeHtml(SYSTEM_TYPES[q.systemType] || '')}</td>
                <td><strong>${formatCurrency(q.grandTotal)}</strong></td>
                <td><span class="badge ${status.class}">${status.label}</span></td>
                <td>${formatDate(q.createdAt)}</td>
                <td>
                  <div class="table-actions">
                    <button class="btn btn-ghost btn-icon btn-sm" data-action="view" data-id="${q.id}" data-tooltip="View">
                      ${createIcon('eye')}
                    </button>
                    <button class="btn btn-ghost btn-icon btn-sm" data-action="edit" data-id="${q.id}" data-tooltip="Edit">
                      ${createIcon('edit')}
                    </button>
                    <button class="btn btn-ghost btn-icon btn-sm" data-action="duplicate" data-id="${q.id}" data-tooltip="Duplicate">
                      ${createIcon('copy')}
                    </button>
                    <button class="btn btn-whatsapp btn-icon btn-sm" data-action="whatsapp" data-id="${q.id}" data-tooltip="WhatsApp">
                      ${createIcon('whatsapp')}
                    </button>
                    <button class="btn btn-ghost btn-icon btn-sm" data-action="status" data-id="${q.id}" data-tooltip="Update Status">
                      ${createIcon('refresh')}
                    </button>
                    ${hasRole('super_admin', 'admin', 'manager') ? `<button class="btn btn-ghost btn-icon btn-sm" data-action="delete" data-id="${q.id}" data-tooltip="Delete" style="color: var(--color-danger-light);">
                      ${createIcon('trash')}
                    </button>` : ''}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function bindActions(container, quotations, customers) {
  container.querySelectorAll('[data-action="view"]').forEach(btn => {
    btn.addEventListener('click', () => navigate('/quotations/' + btn.dataset.id));
  });

  container.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => navigate('/quotation-builder/' + btn.dataset.id));
  });

  container.querySelectorAll('[data-action="duplicate"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const q = quotations.find(q => String(q.id) === btn.dataset.id);
      if (!q) return;
      const { addQuotation } = await import('../db/database.js');
      const newQ = { ...q };
      delete newQ.id;
      newQ.status = 'draft';
      newQ.quotationNumber = `${q.quotationNumber}-COPY-${Date.now().toString().slice(-5)}`;
      newQ.createdAt = new Date().toISOString();
      await addQuotation(newQ);
      toast.success('Quotation duplicated');
      renderQuotations();
    });
  });

  container.querySelectorAll('[data-action="whatsapp"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const q = quotations.find(q => String(q.id) === btn.dataset.id);
      const customer = customers.find(c => c.id === q?.customerId);
      if (q && customer) sendQuotationWhatsApp(customer, q);
    });
  });

  container.querySelectorAll('[data-action="status"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const q = quotations.find(q => String(q.id) === btn.dataset.id);
      if (!q) return;
      const statuses = ['draft', 'sent', 'accepted', 'rejected', 'expired'];
      const formEl = document.createElement('div');
      formEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          ${statuses.map(s => `
            <label class="card" style="cursor: pointer; padding: 1rem; ${q.status === s ? 'border-color: var(--color-accent); background: rgba(250,76,10,0.06);' : ''}">
              <input type="radio" name="status" value="${s}" ${q.status === s ? 'checked' : ''} style="margin-right: 0.75rem;" />
              <span class="badge ${STATUS_CONFIG[s].class}" style="margin-right: 0.5rem;">${STATUS_CONFIG[s].label}</span>
            </label>
          `).join('')}
        </div>
        <div class="modal-footer" style="margin: 1.5rem -1.5rem -1.5rem; padding: 1rem 1.5rem;">
          <button class="btn btn-secondary" id="status-cancel">Cancel</button>
          <button class="btn btn-primary" id="status-save">${createIcon('save')} Update</button>
        </div>
      `;
      openModal({ title: 'Update Status', content: formEl, size: 'sm' });
      document.getElementById('status-cancel')?.addEventListener('click', closeModal);
      document.getElementById('status-save')?.addEventListener('click', async () => {
        const newStatus = formEl.querySelector('input[name="status"]:checked')?.value;
        if (newStatus) {
          await updateQuotation(q.id, { status: newStatus });
          toast.success('Status updated');
          closeModal();
          renderQuotations();
        }
      });
    });
  });

  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const confirmed = await showConfirm({
        title: 'Delete Quotation?',
        message: 'This quotation will be permanently removed.',
        confirmText: 'Delete',
      });
      if (confirmed) {
        try { await deleteQuotation(btn.dataset.id); toast.success('Quotation deleted'); renderQuotations(); }
        catch (error) { toast.error(error.message); }
      }
    });
  });
}

async function showQuotationDetail(id) {
  const container = document.getElementById('page-content');
  const q = await getQuotation(id);
  if (!q) {
    container.innerHTML = '<div class="page-body"><div class="empty-state"><h4>Quotation not found</h4></div></div>';
    return;
  }

  const customer = await getCustomer(q.customerId);
  const status = STATUS_CONFIG[q.status] || STATUS_CONFIG.draft;
  const systemLabel = SYSTEM_TYPES[q.systemType] || 'On-Grid';
  const subtotal = (q.items || []).reduce((s, i) => s + (i.quantity * i.unitPrice), 0);
  const discountAmount = q.discountType === 'percent' ? subtotal * ((q.discount || 0) / 100) : (q.discount || 0);
  const grandTotal = q.grandTotal || (subtotal - discountAmount);
  const terms = q.termsAndConditions || DEFAULT_TERMS;
  const dateStr = new Date(q.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const [companyName, companyAddress, companyPhone, companyWhatsapp, companyEmail, companyWebsite, companyTagline, companyCredentials] = await Promise.all([
    getSetting('companyName'), getSetting('companyAddress'), getSetting('companyPhone'), getSetting('companyWhatsapp'),
    getSetting('companyEmail'), getSetting('companyWebsite'), getSetting('companyTagline'), getSetting('companyCredentials'),
  ]);
  const company = {
    name: companyName || 'Skyland Energy (Pvt.) Ltd', address: companyAddress || '286 H-1, Johar Town, Lahore, Pakistan',
    phone: companyPhone || '+92 42 32353019', whatsapp: companyWhatsapp || '+92 310 8134361',
    email: companyEmail || 'info@theskylandenergy.com', website: companyWebsite || 'https://www.theskylandenergy.com',
    tagline: companyTagline || 'Your Energy Management Company', credentials: companyCredentials || 'AEDB & PEC Approved',
  };

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <button class="btn btn-ghost" id="back-btn">${createIcon('arrow-left')} Back</button>
        <div>
          <h1 class="page-title">${escapeHtml(q.quotationNumber)}</h1>
          <p class="page-subtitle">${escapeHtml(customer?.name || '')} • <span class="badge ${status.class}">${escapeHtml(status.label)}</span></p>
        </div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" id="edit-btn">${createIcon('edit')} Edit</button>
        <button class="btn btn-outline" id="pdf-btn">${createIcon('download')} PDF</button>
        <button class="btn btn-outline" id="email-btn" ${customer?.email ? '' : 'disabled'} title="${customer?.email ? `Email to ${escapeHtml(customer.email)}` : 'Add a customer email address first'}">${createIcon('mail')} Email</button>
        <button class="btn btn-whatsapp" id="wa-btn">${createIcon('whatsapp')} WhatsApp</button>
        <button class="btn btn-ghost" id="print-btn">${createIcon('printer')} Print</button>
      </div>
    </div>

    <div class="page-body">
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
            <div>Ref: ${escapeHtml(q.quotationNumber)}</div>
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
          Quotation for ${escapeHtml(q.systemSize)}-KW ${escapeHtml(systemLabel)} Solar System:
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
            ${(q.items || []).filter(i => i.name).map((item, idx) => `
              <tr style="border-bottom: 1px solid #e5e7eb; ${idx % 2 === 1 ? 'background: #f9fafb;' : ''}">
                <td style="padding: 8px 12px; color: #666;">${idx + 1}</td>
                <td style="padding: 8px 12px;">${escapeHtml(item.name)}</td>
                <td style="padding: 8px 12px; text-align: center;">${item.quantity || '-'}</td>
                <td style="padding: 8px 12px; text-align: right; font-weight: 500;">${formatCurrency(item.quantity * item.unitPrice).replace('PKR ', '')}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background: #073d72; color: #fff;">
              <td colspan="3" style="padding: 10px 12px; text-align: right; font-weight: 700;">Total</td>
              <td style="padding: 10px 12px; text-align: right; font-weight: 700;">${formatCurrency(grandTotal).replace('PKR ', '')}/-</td>
            </tr>
          </tfoot>
        </table>

        <h3 style="color: #073d72; margin-bottom: 0.75rem;">Terms & Conditions:</h3>
        <ol style="padding-left: 1.25rem; color: #555; font-size: 0.85rem; line-height: 1.8;">
          ${terms.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
        </ol>

        <div style="margin-top: 3rem; display: flex; justify-content: space-between;">
          <div>
            <div style="margin-bottom: 0.5rem;"><strong>Thanks & Regards,</strong></div>
            <div style="margin-top: 2rem; border-top: 1px solid #999; padding-top: 0.5rem; width: 200px;">
              Sales Team<br><strong>${escapeHtml(company.name)}</strong><br>
              <span style="font-size: 0.72rem; color: #666;">${escapeHtml(company.website.replace(/^https?:\/\//, ''))}</span>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="margin-bottom: 1rem;">Client's Name: _________________</div>
            <div style="margin-top: 2rem; border-top: 1px solid #999; padding-top: 0.5rem; width: 200px; margin-left: auto;">
              Signature<br>Date: _________________
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#back-btn')?.addEventListener('click', () => navigate('/quotations'));
  container.querySelector('#edit-btn')?.addEventListener('click', () => navigate('/quotation-builder/' + id));
  container.querySelector('#pdf-btn')?.addEventListener('click', async () => {
    const { generateQuotationPDF } = await import('../utils/pdf-generator.js');
    generateQuotationPDF(document.getElementById('quotation-preview'), q.quotationNumber);
  });
  container.querySelector('#email-btn')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    const previousHtml = button.innerHTML;
    button.textContent = 'Sending...';
    try {
      await sendQuotationEmail(id);
      toast.success(`Quotation emailed to ${customer.email}`);
      await showQuotationDetail(id);
    } catch (error) {
      button.disabled = false;
      button.innerHTML = previousHtml;
      toast.error(error.message || 'Could not email quotation');
    }
  });
  container.querySelector('#wa-btn')?.addEventListener('click', () => {
    if (customer) sendQuotationWhatsApp(customer, q);
  });
  container.querySelector('#print-btn')?.addEventListener('click', () => window.print());
}
