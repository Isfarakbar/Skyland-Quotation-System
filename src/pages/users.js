import { authRequest, getCurrentUser } from '../auth.js';
import { createIcon } from '../components/icons.js';
import { toggleMobileSidebar } from '../components/sidebar.js';
import { escapeHtml, formatDate } from '../utils/helpers.js';
import { toast } from '../components/toast.js';
import { openModal } from '../components/modal.js';

const roleLabel = role => ({ super_admin: 'Super Admin', admin: 'Admin', manager: 'Manager', employee: 'Employee' }[role] || role);

function renderRole(user, me) {
  if (me.role !== 'super_admin' || user.role === 'super_admin') return roleLabel(user.role);
  return `<select class="form-select table-select" data-role-user="${user.id}">
    ${['admin', 'manager', 'employee'].map(role => `<option value="${role}" ${user.role === role ? 'selected' : ''}>${roleLabel(role)}</option>`).join('')}
  </select>`;
}

function renderActions(user, me) {
  const details = `<button class="btn btn-sm btn-ghost" data-details="${user.id}">Details</button>`;
  if (user.role === 'super_admin' || user.id === me.id) return details;
  if (me.role === 'super_admin' && user.status === 'pending') {
    return `<div class="table-actions">${details}<button class="btn btn-sm btn-primary" data-approve="${user.id}">Approve</button><button class="btn btn-sm btn-secondary" data-reject="${user.id}">Reject</button></div>`;
  }
  const adminCanManage = me.role === 'super_admin' || (me.role === 'admin' && ['manager', 'employee'].includes(user.role) && ['active', 'suspended'].includes(user.status));
  if (!adminCanManage) return details;
  const nextStatus = user.status === 'active' ? 'suspended' : 'active';
  return `<div class="table-actions">${details}<button class="btn btn-sm ${nextStatus === 'active' ? 'btn-primary' : 'btn-secondary'}" data-status-user="${user.id}" data-status="${nextStatus}">${nextStatus === 'active' ? 'Reactivate' : 'Suspend'}</button></div>`;
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
    <div class="page-header"><div class="page-header-left"><button class="mobile-menu-toggle" id="mobile-menu-btn">${createIcon('menu')}</button><div><h1 class="page-title">Team access</h1><p class="page-subtitle">${me.role === 'super_admin' ? 'Approve registrations, assign roles, and control account access' : 'Review team profiles and suspend or reactivate operational accounts'}</p></div></div></div>
    <div class="page-body"><div class="team-summary"><span><strong>${users.filter(user => user.status === 'pending').length}</strong> pending</span><span><strong>${users.filter(user => user.status === 'active').length}</strong> active</span><span><strong>${users.filter(user => user.status === 'suspended').length}</strong> suspended</span></div>
      <details class="card role-access-guide"><summary><strong>Role responsibilities and access</strong></summary><div class="table-container"><table><thead><tr><th>Role</th><th>Primary responsibility</th><th>Control level</th></tr></thead><tbody>
        <tr><td>Super Admin</td><td>Governance, registrations, roles, company identity, and complete data control</td><td>Full access</td></tr>
        <tr><td>Admin</td><td>Catalog, rates, company settings, exports/imports, and operational account suspension</td><td>Administrative access</td></tr>
        <tr><td>Manager</td><td>Sales operations, catalog updates, quotation defaults, approvals, and record cleanup</td><td>Operational management</td></tr>
        <tr><td>Employee</td><td>Create customers and quotations, manage owned work, send proposals, and maintain profile</td><td>Day-to-day sales</td></tr>
      </tbody></table></div></details>
      <div class="table-container"><table class="team-table"><thead><tr><th>Team member</th><th>Role</th><th>Contact</th><th>Requested</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${users.map(user => `<tr><td><div class="user-cell">${user.profilePicture ? `<img src="${escapeHtml(user.profilePicture)}" class="user-avatar" alt="" />` : `<span class="user-avatar user-avatar-fallback">${escapeHtml(user.firstName?.[0] || '?')}</span>`}<div><strong>${escapeHtml(`${user.firstName} ${user.lastName}`)}</strong><small>${escapeHtml(user.designation || '')}</small></div></div></td><td>${renderRole(user, me)}</td><td>${escapeHtml(user.email)}<br/><small>${escapeHtml(user.phone)}</small></td><td>${formatDate(user.createdAt)}</td><td><span class="badge badge-${user.status}">${user.status}</span></td><td>${renderActions(user, me)}</td></tr>`).join('')}
      </tbody></table></div></div>`;

  container.querySelector('#mobile-menu-btn')?.addEventListener('click', toggleMobileSidebar);
  container.querySelectorAll('[data-details]').forEach(button => button.addEventListener('click', () => showUserDetails(users.find(user => user.id === button.dataset.details))));
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
