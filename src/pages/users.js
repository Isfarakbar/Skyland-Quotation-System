import { authRequest, getCurrentUser } from '../auth.js';
import { createIcon } from '../components/icons.js';
import { toggleMobileSidebar } from '../components/sidebar.js';
import { escapeHtml, formatDate } from '../utils/helpers.js';
import { toast } from '../components/toast.js';
import { closeModal, openModal } from '../components/modal.js';

const roleLabel = role => ({ super_admin: 'Super Admin', admin: 'Admin', manager: 'Manager', employee: 'Employee' }[role] || role);
const statusLabel = status => ({ pending: 'Pending approval', active: 'Active', suspended: 'Suspended', rejected: 'Rejected' }[status] || status);
const safeText = (value, fallback = '—') => String(value || '').trim() || fallback;
const displayName = user => {
  const fullName = [user.firstName, user.lastName].map(value => String(value || '').trim()).filter(Boolean).join(' ');
  return fullName || safeText(user.email?.split('@')[0], 'Team member');
};
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
  if (me.role !== 'super_admin' || user.role === 'super_admin') return `<span class="team-role-label">${roleLabel(user.role)}</span>`;
  return `<select class="form-select table-select" data-role-user="${user.id}" aria-label="Change ${escapeHtml(displayName(user))}'s role">
    ${['admin', 'manager', 'employee'].map(role => `<option value="${role}" ${user.role === role ? 'selected' : ''}>${roleLabel(role)}</option>`).join('')}
  </select>`;
}

function renderActions(user, me) {
  const details = `<button class="btn btn-sm btn-ghost" data-details="${user.id}">${createIcon('eye')} Details</button>`;
  if (user.role === 'super_admin' || user.id === me.id) return details;
  const access = me.role === 'super_admin' && ['manager', 'employee'].includes(user.role)
    ? `<button class="btn btn-sm btn-outline team-access-button" data-access="${user.id}">${createIcon('settings')} Manage access</button>` : '';
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
  form.innerHTML = `<div class="access-editor-intro"><strong>${escapeHtml(displayName(user))}</strong><span>${roleLabel(user.role)} · Changes take effect immediately and sign the user out of existing sessions.</span></div>
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

async function showUserDetails(user) {
  const fullUser = await authRequest(`/users/${user.id}`);
  openModal({
    title: displayName(fullUser),
    size: 'lg',
    content: `<div class="user-detail-grid">
      <div><span>Email</span><strong>${escapeHtml(safeText(fullUser.email))}</strong></div><div><span>Phone</span><strong>${escapeHtml(safeText(fullUser.phone))}</strong></div>
      <div><span>Role</span><strong>${roleLabel(fullUser.role)}</strong></div><div><span>Status</span><strong>${escapeHtml(statusLabel(fullUser.status))}</strong></div>
      <div><span>CNIC / identity</span><strong>${escapeHtml(safeText(fullUser.cnic))}</strong></div><div><span>Date of birth</span><strong>${formatDate(fullUser.dateOfBirth)}</strong></div>
      <div><span>Department</span><strong>${escapeHtml(safeText(fullUser.department))}</strong></div><div><span>Designation</span><strong>${escapeHtml(safeText(fullUser.designation))}</strong></div>
      <div><span>Employee ID</span><strong>${escapeHtml(safeText(fullUser.employeeId))}</strong></div><div><span>City</span><strong>${escapeHtml(safeText(fullUser.city))}</strong></div>
      <div class="user-detail-wide"><span>Address</span><strong>${escapeHtml(safeText(fullUser.address))}</strong></div>
      <div><span>Emergency contact</span><strong>${escapeHtml(safeText(fullUser.emergencyContactName))}</strong></div><div><span>Emergency phone</span><strong>${escapeHtml(safeText(fullUser.emergencyContactPhone))}</strong></div>
      <div><span>Requested</span><strong>${formatDate(fullUser.createdAt)}</strong></div><div><span>Approved</span><strong>${formatDate(fullUser.approvedAt)}</strong></div>
    </div>`,
  });
}

function renderTeamRows(users, me) {
  if (!users.length) return `<div class="team-empty"><div>${createIcon('users', 32)}</div><strong>No team members found</strong><span>Try another name or account status.</span></div>`;
  return users.map(user => {
    const name = displayName(user);
    const customAccess = Object.keys(user.permissions || {}).length > 0;
    return `<article class="team-member-row" data-user-row="${user.id}">
      <div class="user-cell team-member-identity">
        ${user.profilePicture ? `<img src="${escapeHtml(user.profilePicture)}" class="user-avatar" alt="" loading="lazy" />` : `<span class="user-avatar user-avatar-fallback">${escapeHtml(name[0]?.toUpperCase() || '?')}</span>`}
        <div><strong title="${escapeHtml(name)}">${escapeHtml(name)}</strong><small>${escapeHtml(safeText(user.designation, 'Profile incomplete'))}</small></div>
      </div>
      <div class="team-role-control"><span class="team-field-label">Role</span>${renderRole(user, me)}${customAccess ? '<span class="team-custom-access">Custom access</span>' : '<span class="team-default-access">Role defaults</span>'}</div>
      <div class="team-contact"><span class="team-field-label">Contact</span><a href="mailto:${escapeHtml(user.email)}" title="${escapeHtml(user.email)}">${escapeHtml(safeText(user.email))}</a><small>${escapeHtml(safeText(user.phone))}</small></div>
      <div class="team-requested"><span class="team-field-label">Requested</span><strong>${formatDate(user.createdAt)}</strong></div>
      <div class="team-account-status"><span class="team-field-label">Status</span><span class="badge badge-${user.status}">${escapeHtml(statusLabel(user.status))}</span></div>
      <div class="table-actions team-member-actions">${renderActions(user, me)}</div>
    </article>`;
  }).join('');
}

export async function renderUsers() {
  const container = document.getElementById('page-content');
  const me = getCurrentUser();
  const users = await authRequest('/users');
  container.innerHTML = `
    <div class="page-header team-page-header"><div class="page-header-left"><button class="mobile-menu-toggle" id="mobile-menu-btn">${createIcon('menu')}</button><div><h1 class="page-title">Team Access</h1><p class="page-subtitle">${me.role === 'super_admin' ? 'Approve accounts, assign roles, and tailor access for every team member.' : 'Review team profiles and manage operational account status.'}</p></div></div></div>
    <div class="page-body team-page-body">
      <section class="team-summary" aria-label="Account summary">
        <button type="button" data-status-filter="pending"><span class="team-summary-icon team-summary-pending">${createIcon('alert-circle')}</span><span><strong>${users.filter(user => user.status === 'pending').length}</strong><small>Pending approval</small></span></button>
        <button type="button" data-status-filter="active"><span class="team-summary-icon team-summary-active">${createIcon('check-circle')}</span><span><strong>${users.filter(user => user.status === 'active').length}</strong><small>Active accounts</small></span></button>
        <button type="button" data-status-filter="suspended"><span class="team-summary-icon team-summary-suspended">${createIcon('alert-triangle')}</span><span><strong>${users.filter(user => user.status === 'suspended').length}</strong><small>Suspended</small></span></button>
      </section>
      <details class="role-access-guide"><summary><span class="role-guide-icon">${createIcon('info')}</span><span><strong>How team access works</strong><small>Roles set the baseline; individual access lets you grant or remove specific capabilities.</small></span>${createIcon('chevron-down')}</summary><div class="role-guide-grid">
        <div><strong>Super Admin</strong><span>Full governance and data control</span></div><div><strong>Admin</strong><span>Catalog, settings and account status</span></div><div><strong>Manager</strong><span>Sales operations and quotations</span></div><div><strong>Employee</strong><span>Customers and owned quotations</span></div>
      </div></details>
      <section class="team-directory-card">
        <div class="team-directory-toolbar"><div><h2>Team directory</h2><p><span id="team-visible-count">${users.length}</span> of ${users.length} accounts</p></div><label class="team-search">${createIcon('search')}<input id="team-search-input" type="search" placeholder="Search name, email or role" aria-label="Search team members" /></label></div>
        <div class="team-directory-head" aria-hidden="true"><span>Team member</span><span>Role & access</span><span>Contact</span><span>Requested</span><span>Status</span><span>Actions</span></div>
        <div id="team-roster">${renderTeamRows(users, me)}</div>
      </section>
    </div>`;

  container.querySelector('#mobile-menu-btn')?.addEventListener('click', toggleMobileSidebar);
  let selectedStatus = 'all';
  const roster = container.querySelector('#team-roster');
  const applyFilters = () => {
    const query = container.querySelector('#team-search-input').value.trim().toLowerCase();
    const filtered = users.filter(user => {
      const matchesStatus = selectedStatus === 'all' || user.status === selectedStatus;
      const haystack = [displayName(user), user.email, user.phone, roleLabel(user.role), user.designation].join(' ').toLowerCase();
      return matchesStatus && (!query || haystack.includes(query));
    });
    roster.innerHTML = renderTeamRows(filtered, me);
    container.querySelector('#team-visible-count').textContent = filtered.length;
  };
  container.querySelector('#team-search-input').addEventListener('input', applyFilters);
  container.querySelectorAll('[data-status-filter]').forEach(button => button.addEventListener('click', () => {
    const nextStatus = button.dataset.statusFilter;
    selectedStatus = selectedStatus === nextStatus ? 'all' : nextStatus;
    container.querySelectorAll('[data-status-filter]').forEach(item => item.classList.toggle('active', item.dataset.statusFilter === selectedStatus));
    applyFilters();
  }));
  roster.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;
    const user = users.find(item => item.id === (button.dataset.details || button.dataset.access || button.dataset.approve || button.dataset.reject || button.dataset.statusUser));
    if (button.dataset.details && user) {
      button.disabled = true;
      try { await showUserDetails(user); } catch (error) { toast.error(error.message); } finally { button.disabled = false; }
      return;
    }
    if (button.dataset.access && user) return showAccessEditor(user);
    if (button.dataset.approve || button.dataset.reject) {
      button.disabled = true;
      try {
        await authRequest(`/users/${button.dataset.approve || button.dataset.reject}/approval`, { method: 'PATCH', body: JSON.stringify({ status: button.dataset.approve ? 'active' : 'rejected' }) });
        toast.success(button.dataset.approve ? 'Account approved' : 'Registration rejected');
        renderUsers();
      } catch (error) { toast.error(error.message); button.disabled = false; }
      return;
    }
    if (button.dataset.statusUser) {
      button.disabled = true;
      try { await authRequest(`/users/${button.dataset.statusUser}`, { method: 'PATCH', body: JSON.stringify({ status: button.dataset.status }) }); toast.success('Account status updated'); renderUsers(); }
      catch (error) { toast.error(error.message); button.disabled = false; }
    }
  });
  roster.addEventListener('change', async event => {
    const select = event.target.closest('[data-role-user]');
    if (!select) return;
    select.disabled = true;
    try {
      await authRequest(`/users/${select.dataset.roleUser}`, { method: 'PATCH', body: JSON.stringify({ role: select.value }) });
      toast.success('Role updated');
      renderUsers();
    } catch (error) { toast.error(error.message); renderUsers(); }
  });
}
