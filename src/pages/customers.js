// ============================================
// SKYLAND ENERGY — Customers Page
// ============================================
import { getAllCustomers, addCustomer, updateCustomer, deleteCustomer, getAllQuotations } from '../db/database.js';
import { getInitials, formatDate, matchesSearch, debounce, formatWhatsAppNumber, escapeHtml } from '../utils/helpers.js';
import { createIcon } from '../components/icons.js';
import { openModal, closeModal } from '../components/modal.js';
import { showConfirm } from '../components/confirm-dialog.js';
import { toast } from '../components/toast.js';
import { sendGreeting } from '../utils/whatsapp.js';
import { navigate } from '../router.js';
import { toggleMobileSidebar } from '../components/sidebar.js';
import { getCurrentUser, hasPermission } from '../auth.js';

let searchQuery = '';

export async function renderCustomers() {
  const container = document.getElementById('page-content');
  const customers = await getAllCustomers();
  const quotations = await getAllQuotations();

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <button class="mobile-menu-toggle" id="mobile-menu-btn">${createIcon('menu')}</button>
        <div>
          <h1 class="page-title">Customers</h1>
          <p class="page-subtitle">${customers.length} customers</p>
        </div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-primary" id="add-customer-btn">
          ${createIcon('plus')} Add Customer
        </button>
      </div>
    </div>

    <div class="page-body">
      <div class="page-toolbar">
        <div class="page-toolbar-left">
          <div class="search-input-wrapper">
            ${createIcon('search')}
            <input type="text" class="search-input" placeholder="Search customers..." id="customer-search" value="${escapeHtml(searchQuery)}" />
          </div>
        </div>
      </div>

      <div class="card card-elevated">
        ${renderCustomerTable(customers, quotations)}
      </div>
    </div>
  `;

  container.querySelector('#mobile-menu-btn')?.addEventListener('click', toggleMobileSidebar);
  container.querySelector('#add-customer-btn')?.addEventListener('click', () => openCustomerForm());

  container.querySelector('#customer-search')?.addEventListener('input', debounce((e) => {
    searchQuery = e.target.value;
    const tableWrapper = container.querySelector('.card.card-elevated');
    tableWrapper.innerHTML = renderCustomerTable(customers, quotations);
    bindTableActions(container, customers);
  }, 200));

  bindTableActions(container, customers);
}

function renderCustomerTable(customers, quotations) {
  const filtered = customers.filter(c =>
    matchesSearch(c, searchQuery, ['name', 'phone', 'city', 'email'])
  );

  if (filtered.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">${createIcon('users', 48)}</div>
        <h4 class="empty-state-title">No customers found</h4>
        <p class="empty-state-text">${searchQuery ? 'Try a different search' : 'Add your first customer to get started'}</p>
      </div>
    `;
  }

  return `
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Phone</th>
            <th>City</th>
            <th>Project Type</th>
            <th>Quotations</th>
            <th>Added</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(c => {
            const quoteCount = quotations.filter(q => q.customerId === c.id).length;
            const canEdit = hasPermission('customers_manage_all') || !c.createdBy || String(c.createdBy) === String(getCurrentUser()?.id);
            return `
              <tr>
                <td>
                  <div class="customer-name-cell">
                    <div class="customer-avatar">${escapeHtml(getInitials(c.name))}</div>
                    <div>
                      <strong>${escapeHtml(c.name)}</strong>
                      ${c.email ? `<div class="text-xs text-secondary">${escapeHtml(c.email)}</div>` : ''}
                    </div>
                  </div>
                </td>
                <td>${escapeHtml(c.phone || '-')}</td>
                <td>${escapeHtml(c.city || '-')}</td>
                <td><span class="badge badge-category">${escapeHtml(c.projectType || 'N/A')}</span></td>
                <td>${quoteCount}</td>
                <td>${formatDate(c.createdAt)}</td>
                <td>
                  <div class="table-actions">
                    <button class="btn btn-whatsapp btn-icon btn-sm" data-action="whatsapp" data-id="${c.id}" data-tooltip="WhatsApp">
                      ${createIcon('whatsapp')}
                    </button>
                    <button class="btn btn-ghost btn-icon btn-sm" data-action="quote" data-id="${c.id}" data-tooltip="New Quotation">
                      ${createIcon('file-plus')}
                    </button>
                    ${canEdit ? `<button class="btn btn-ghost btn-icon btn-sm" data-action="edit" data-id="${c.id}" data-tooltip="Edit">
                      ${createIcon('edit')}
                    </button>` : ''}
                    ${hasPermission('customers_delete') ? `<button class="btn btn-ghost btn-icon btn-sm" data-action="delete" data-id="${c.id}" data-tooltip="Delete" style="color: var(--color-danger-light);">
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

function bindTableActions(container, customers) {
  container.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const customer = customers.find(c => String(c.id) === btn.dataset.id);
      if (customer) openCustomerForm(customer);
    });
  });

  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const confirmed = await showConfirm({
        title: 'Delete Customer?',
        message: 'This will also remove their association with existing quotations.',
        confirmText: 'Delete Customer',
      });
      if (confirmed) {
        try { await deleteCustomer(btn.dataset.id); toast.success('Customer deleted'); renderCustomers(); }
        catch (error) { toast.error(error.message); }
      }
    });
  });

  container.querySelectorAll('[data-action="whatsapp"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const customer = customers.find(c => String(c.id) === btn.dataset.id);
      if (customer) {
        sendGreeting(customer.name, customer.whatsapp || customer.phone);
      }
    });
  });

  container.querySelectorAll('[data-action="quote"]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigate('/quotation-builder/customer-' + btn.dataset.id);
    });
  });
}

export function openCustomerForm(existing = null) {
  const isEdit = !!existing;
  const c = existing || {};

  const formEl = document.createElement('div');
  formEl.innerHTML = `
    <form id="customer-form" autocomplete="off">
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Full Name <span class="required">*</span></label>
          <input type="text" class="form-input" id="cust-name" value="${escapeHtml(c.name || '')}" placeholder="e.g., Mr. Abid Ali" required />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Phone Number <span class="required">*</span></label>
            <input type="tel" class="form-input" id="cust-phone" value="${escapeHtml(c.phone || '')}" placeholder="e.g., 0300-1234567" required />
          </div>
          <div class="form-group">
            <label class="form-label">WhatsApp Number</label>
            <input type="tel" class="form-input" id="cust-whatsapp" value="${escapeHtml(c.whatsapp || '')}" placeholder="Same as phone if blank" />
            <span class="form-hint">Leave empty to use phone number</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-input" id="cust-email" value="${escapeHtml(c.email || '')}" placeholder="email@example.com" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">City <span class="required">*</span></label>
            <input type="text" class="form-input" id="cust-city" value="${escapeHtml(c.city || '')}" placeholder="e.g., Lahore" required />
          </div>
          <div class="form-group">
            <label class="form-label">Project Type</label>
            <select class="form-select" id="cust-project-type">
              <option value="residential" ${c.projectType === 'residential' ? 'selected' : ''}>Residential</option>
              <option value="commercial" ${c.projectType === 'commercial' ? 'selected' : ''}>Commercial</option>
              <option value="industrial" ${c.projectType === 'industrial' ? 'selected' : ''}>Industrial</option>
              <option value="agriculture" ${c.projectType === 'agriculture' ? 'selected' : ''}>Agriculture</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Address</label>
          <textarea class="form-textarea" id="cust-address" placeholder="Full address" style="min-height: 60px;">${escapeHtml(c.address || '')}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Service Interest</label>
          <select class="form-select" id="cust-service-interest">
            <option value="solar" ${!c.serviceInterest || c.serviceInterest === 'solar' ? 'selected' : ''}>Solar System</option>
            <option value="battery-storage" ${c.serviceInterest === 'battery-storage' ? 'selected' : ''}>Battery Storage</option>
            <option value="energy-audit" ${c.serviceInterest === 'energy-audit' ? 'selected' : ''}>Energy Audit</option>
            <option value="energy-management" ${c.serviceInterest === 'energy-management' ? 'selected' : ''}>Energy Management System</option>
            <option value="mep" ${c.serviceInterest === 'mep' ? 'selected' : ''}>MEP Services</option>
            <option value="pfi-harmonic-filters" ${c.serviceInterest === 'pfi-harmonic-filters' ? 'selected' : ''}>PFI & Harmonic Filters</option>
            <option value="operations-maintenance" ${c.serviceInterest === 'operations-maintenance' ? 'selected' : ''}>Operations & Maintenance</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea class="form-textarea" id="cust-notes" placeholder="Internal notes..." style="min-height: 60px;">${escapeHtml(c.notes || '')}</textarea>
        </div>
      </div>

      <div class="modal-footer" style="margin: 1.5rem -1.5rem -1.5rem; padding: 1rem 1.5rem;">
        <button type="button" class="btn btn-secondary" id="form-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary">
          ${createIcon('save')} ${isEdit ? 'Update Customer' : 'Add Customer'}
        </button>
      </div>
    </form>
  `;

  openModal({
    title: isEdit ? 'Edit Customer' : 'Add New Customer',
    content: formEl,
    size: 'lg',
  });

  document.getElementById('form-cancel')?.addEventListener('click', closeModal);

  document.getElementById('customer-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('cust-name').value.trim(),
      phone: document.getElementById('cust-phone').value.trim(),
      whatsapp: document.getElementById('cust-whatsapp').value.trim(),
      email: document.getElementById('cust-email').value.trim(),
      city: document.getElementById('cust-city').value.trim(),
      projectType: document.getElementById('cust-project-type').value,
      serviceInterest: document.getElementById('cust-service-interest').value,
      address: document.getElementById('cust-address').value.trim(),
      notes: document.getElementById('cust-notes').value.trim(),
    };

    if (!data.name || !data.phone || !data.city) {
      toast.warning('Please fill in required fields');
      return;
    }

    try {
      if (isEdit) {
        await updateCustomer(existing.id, data);
        toast.success('Customer updated');
      } else {
        await addCustomer(data);
        toast.success('Customer added');
      }
      closeModal();
      renderCustomers();
    } catch (err) {
      toast.error('Failed to save: ' + err.message);
    }
  });

  return formEl;
}
