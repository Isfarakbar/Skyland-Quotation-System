import { authRequest, getCurrentUser } from '../auth.js';
import { createIcon } from '../components/icons.js';
import { toggleMobileSidebar } from '../components/sidebar.js';
import { escapeHtml, formatDate } from '../utils/helpers.js';
import { toast } from '../components/toast.js';
import { closeModal, openModal } from '../components/modal.js';

const roleLabel = role => ({ super_admin: 'Super Admin', admin: 'Admin', manager: 'Manager', employee: 'Employee' }[role] || role);
const ACCESS_OPTIONS = [
  { group: 'Products & pricing', key: 'products_manage', label: 'Create and edit products', detail: 'Add catalog items, change specifications and upload product pictures.' },
  { group: 'Products & pricing', key: 'products_delete', label: 'Delete products', detail: 'Permanently remove items from the product catalog.' },
  { group: 'Products & pricing', key: 'rates_view', label: 'View price list', detail: 'Open the catalog rates screen.' },
  { group: 'Products & pricing', key: 'rates_manage', label: 'Edit product rates', detail: 'Change panel, inverter and battery prices.' },
  { group: 'Customers', key: 'customers_manage_all', label: 'Edit all customers', detail: 'Without this, the user can edit only customers they created.' },
  { group: 'Customers', key: 'customers_delete', label: 'Delete customers', detail: 'Delete customers that have no linked quotations.' },
  { group: 'Quotations', key: 'quotations_manage_all', label: 'Edit all quotations', detail: 'Without this, the user can edit only quotations they created.' },
  { group: 'Quotations', key: 'quotations_delete', label: 'Delete quotations', detail: 'Permanently remove quotation records.' },
  { group: 'Quotations', key: 'quotations_send_all', label: 'Email all quotations', detail: 'Without this, the user can email only quotations they created.' },
  { group: 'Configuration', key: 'settings_manage', label: 'Edit quotation defaults', detail: 'Manage validity, advance percentage, exchange rate and default terms.' },
];

function renderRole(user, me) {
  if (me.role !== 'super_admin' || user.role === 'super_admin') return roleLabel(user.role);
  return `<select class="form-select table-select" data-role-user="${user.id}">
    ${['admin', 'manager', 'employee'].map(role => `<option value="${role}" ${user.role === role ? 'selected' : ''}>${roleLabel(role)}</option>`).join('')}
  </select>`;
}

function renderActions(user, me) {
  const details = `<button class="btn btn-sm btn-ghost" data-details="${user.id}">Details</button>`;
  if (user.role === 'super_admin' || user.id === me.id) return details;
  const access = me.role === 'super_admin' && ['manager', 'employee'].includes(user.role)
    ? `<button class="btn btn-sm btn-outline" data-access="${user.id}">${createIcon('settings')} Access</button>` : '';
  if (me.role === 'super_admin' && user.status === 'pending') {
    return `<div class="table-actions">${details}${access}<button class="btn btn-sm btn-primary" data-approve="${user.id}">Approve</button><button class="btn btn-sm btn-secondary" data-reject="${user.id}">Reject</button></div>`;
  }
  const adminCanManage = me.role === 'super_admin' || (me.role === 'admin' && ['manager', 'employee'].includes(user.role) && ['active', 'suspended'].includes(user.status));
  if (!adminCanManage) return details;
  const nextStatus = user.status === 'active' ? 'suspended' : 'active';
  return `<div class="table-actions">${details}${access}<button class="btn btn-sm ${nextStatus === 'active' ? 'btn-primary' : 'btn-secondary'}" data-status-user="${user.id}" data-status="${nextStatus}">${nextStatus === 'active' ? 'Reactivate' : 'Suspend'}</button></div>`;
}

function showAccessEditor(user) {
  const form = document.createElement('div');
  const groups = [...new Set(ACCESS_OPTIONS.map(option => option.group))];
  form.innerHTML = `<div class="access-editor-intro"><strong>${escapeHtml(`${user.firstName} ${user.lastName}`)}</strong><span>${roleLabel(user.role)} · Changes take effect immediately and sign the user out of existing sessions.</span></div>
    <div class="permission-groups">${groups.map(group => `<section class="permission-group"><h3>${group}</h3>${ACCESS_OPTIONS.filter(option => option.group === group).map(option => `<label class="permission-option"><input type="checkbox" data-permission="${option.key}" ${user.effectivePermissions?.[option.key] ? 'checked' : ''}/><span><strong>${option.label}</strong><small>${option.detail}</small></span></label>`).join('')}</section>`).join('')}</div>
    <div class="modal-footer permission-footer"><button class="btn btn-secondary" id="reset-access-btn">Use ${roleLabel(user.role)} Defaults</button><button class="btn btn-primary" id="save-access-btn">${createIcon('save')} Save Access</button></div>`;
  openModal({ title: 'Manage Individual Access', content: form, size: 'lg' });
  form.querySelector('#save-access-btn').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    const permissions = Object.fromEntries(ACCESS_OPTIONS.map(option => [option.key, form.querySelector(`[data-permission="${option.key}"]`).checked]));
    try {
      await authRequest(`/users/${user.id}/permissions`, { method: 'PATCH', body: JSON.stringify({ permissions }) });
      toast.success('Individual access updated'); closeModal(); renderUsers();
    } catch (error) { toast.error(error.message); button.disabled = false; }
  });
  form.querySelector('#reset-access-btn').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await authRequest(`/users/${user.id}/permissions`, { method: 'PATCH', body: JSON.stringify({ permissions: {} }) });
      toast.success(`${roleLabel(user.role)} defaults restored`); closeModal(); renderUsers();
    } catch (error) { toast.error(error.message); button.disabled = false; }
  });
}

function showUserDetails(user) {
  openModal({
    title: `${user.firstName} ${user.lastName}`,
    size: 'lg',
    content: `<div class="user-detail-grid">
      <div><span>Email</span><strong>${escapeHtml(user.email)}</strong></div><div><span>Phone</span><strong>${escapeHtml(user.phone)}</strong></div>
      <div><span>Role</span><strong>${roleLabel(user.role)}</strong></div><div><span>Status</span><strong>${escapeHtml(user.status)}</strong></div>
      <div><span>CNIC / identity</span><strong>${escapeHtml(user.cnic)}</strong></div><div><span>Date of birth</span><strong>${formatDate(user.dateOfBirth)}</strong></div>
      <div><span>Department</span><strong>${escapeHtml(user.department)}</strong></div><div><span>Designation</span><strong>${escapeHtml(user.designation)}</strong></div>
      <div><span>Employee ID</span><strong>${escapeHtml(user.employeeId || '—')}</strong></div><div><span>City</span><strong>${escapeHtml(user.city)}</strong></div>
      <div class="user-detail-wide"><span>Address</span><strong>${escapeHtml(user.address)}</strong></div>
      <div><span>Emergency contact</span><strong>${escapeHtml(user.emergencyContactName)}</strong></div><div><span>Emergency phone</span><strong>${escapeHtml(user.emergencyContactPhone)}</strong></div>
      <div><span>Requested</span><strong>${formatDate(user.createdAt)}</strong></div><div><span>Approved</span><strong>${formatDate(user.approvedAt)}</strong></div>
    </div>`,
  });
}

export async function renderUsers() {
  const container = document.getElementById('page-content');
  const me = getCurrentUser();
  const users = await authRequest('/users');
  container.innerHTML = `
    <div class="page-header"><div class="page-header-left"><button class="mobile-menu-toggle" id="mobile-menu-btn">${createIcon('menu')}</button><div><h1 class="page-title">Team Access</h1><p class="page-subtitle">${me.role === 'super_admin' ? 'Approve accounts and control each manager or employee individually' : 'Review team profiles and suspend or reactivate operational accounts'}</p></div></div></div>
    <div class="page-body"><div class="team-summary"><span><strong>${users.filter(user => user.status === 'pending').length}</strong> pending</span><span><strong>${users.filter(user => user.status === 'active').length}</strong> active</span><span><strong>${users.filter(user => user.status === 'suspended').length}</strong> suspended</span></div>
      <details class="card role-access-guide"><summary><strong>Role defaults and individual access</strong></summary><p class="form-hint" style="padding:0 1rem 1rem">Roles provide the starting access. A Super Admin can use the Access button to grant or revoke individual capabilities for any manager or employee.</p><div class="table-container"><table><thead><tr><th>Role</th><th>Primary responsibility</th><th>Default control level</th></tr></thead><tbody>
        <tr><td>Super Admin</td><td>Governance, registrations, roles, company identity, and complete data control</td><td>Full access</td></tr>
        <tr><td>Admin</td><td>Catalog, rates, company settings, exports/imports, and operational account suspension</td><td>Administrative access</td></tr>
        <tr><td>Manager</td><td>Sales operations, catalog updates, quotation defaults, approvals, and record cleanup</td><td>Operational management</td></tr>
        <tr><td>Employee</td><td>Create customers and quotations, manage owned work, send proposals, and maintain profile</td><td>Day-to-day sales</td></tr>
      </tbody></table></div></details>
      <div class="table-container"><table class="team-table"><thead><tr><th>Team member</th><th>Role</th><th>Contact</th><th>Requested</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${users.map(user => `<tr><td><div class="user-cell">${user.profilePicture ? `<img src="${escapeHtml(user.profilePicture)}" class="user-avatar" alt="" />` : `<span class="user-avatar user-avatar-fallback">${escapeHtml(user.firstName?.[0] || '?')}</span>`}<div><strong>${escapeHtml(`${user.firstName} ${user.lastName}`)}</strong><small>${escapeHtml(user.designation || '')}</small></div></div></td><td>${renderRole(user, me)}${Object.keys(user.permissions || {}).length ? '<div><span class="badge badge-pending" style="margin-top:.35rem">Custom access</span></div>' : ''}</td><td>${escapeHtml(user.email)}<br/><small>${escapeHtml(user.phone)}</small></td><td>${formatDate(user.createdAt)}</td><td><span class="badge badge-${user.status}">${user.status}</span></td><td>${renderActions(user, me)}</td></tr>`).join('')}
      </tbody></table></div></div>`;

  container.querySelector('#mobile-menu-btn')?.addEventListener('click', toggleMobileSidebar);
  container.querySelectorAll('[data-details]').forEach(button => button.addEventListener('click', () => showUserDetails(users.find(user => user.id === button.dataset.details))));
  container.querySelectorAll('[data-access]').forEach(button => button.addEventListener('click', () => showAccessEditor(users.find(user => user.id === button.dataset.access))));
  container.querySelectorAll('[data-approve],[data-reject]').forEach(button => button.addEventListener('click', async () => {
    try {
      await authRequest(`/users/${button.dataset.approve || button.dataset.reject}/approval`, { method: 'PATCH', body: JSON.stringify({ status: button.dataset.approve ? 'active' : 'rejected' }) });
      toast.success(button.dataset.approve ? 'Account approved' : 'Registration rejected');
      renderUsers();
    } catch (error) { toast.error(error.message); }
  }));
  container.querySelectorAll('[data-role-user]').forEach(select => select.addEventListener('change', async () => {
    try { await authRequest(`/users/${select.dataset.roleUser}`, { method: 'PATCH', body: JSON.stringify({ role: select.value }) }); toast.success('Role updated'); renderUsers(); }
    catch (error) { toast.error(error.message); renderUsers(); }
  }));
  container.querySelectorAll('[data-status-user]').forEach(button => button.addEventListener('click', async () => {
    try { await authRequest(`/users/${button.dataset.statusUser}`, { method: 'PATCH', body: JSON.stringify({ status: button.dataset.status }) }); toast.success('Account status updated'); renderUsers(); }
    catch (error) { toast.error(error.message); }
  }));
}
