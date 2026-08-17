import { authRequest, getCurrentUser, setCurrentUser, uploadImage } from '../auth.js';
import { createIcon } from '../components/icons.js';
import { toggleMobileSidebar } from '../components/sidebar.js';
import { toast } from '../components/toast.js';
import { escapeHtml } from '../utils/helpers.js';

const dateInputValue = value => value ? new Date(value).toISOString().slice(0, 10) : '';

export async function renderProfile() {
  const container = document.getElementById('page-content');
  const user = getCurrentUser();
  container.innerHTML = `
    <div class="page-header"><div class="page-header-left"><button class="mobile-menu-toggle" id="mobile-menu-btn">${createIcon('menu')}</button><div><h1 class="page-title">My account</h1><p class="page-subtitle">Profile, contact information, and security</p></div></div></div>
    <div class="page-body"><div class="settings-grid">
      <section class="card card-elevated"><div class="card-header"><h3 class="card-title">Profile information</h3></div>
        <form id="profile-form" class="auth-form">
          <div class="profile-photo-row">${user.profilePicture ? `<img src="${escapeHtml(user.profilePicture)}" class="profile-photo" alt="Profile picture" />` : `<span class="profile-photo profile-photo-fallback">${escapeHtml(user.firstName?.[0] || '?')}</span>`}<label>Change picture<input class="form-input" type="file" name="profilePictureFile" accept="image/jpeg,image/png,image/webp" /></label></div>
          <div class="form-row"><label>First name<input class="form-input" name="firstName" value="${escapeHtml(user.firstName)}" required /></label><label>Last name<input class="form-input" name="lastName" value="${escapeHtml(user.lastName)}" required /></label></div>
          <label>Email address<input class="form-input" value="${escapeHtml(user.email)}" disabled /><span class="form-hint">Email changes require administrator assistance.</span></label>
          <div class="form-row"><label>Phone<input class="form-input" name="phone" value="${escapeHtml(user.phone)}" required /></label><label>Alternate phone<input class="form-input" name="alternatePhone" value="${escapeHtml(user.alternatePhone || '')}" /></label></div>
          <div class="form-row"><label>Date of birth<input class="form-input" type="date" name="dateOfBirth" value="${dateInputValue(user.dateOfBirth)}" required /></label><label>Gender<select class="form-select" name="gender" required>${['male','female','other','prefer_not_to_say'].map(value => `<option value="${value}" ${user.gender === value ? 'selected' : ''}>${value.replaceAll('_',' ')}</option>`).join('')}</select></label></div>
          <div class="form-row"><label>City<input class="form-input" name="city" value="${escapeHtml(user.city)}" required /></label><label>Employee ID<input class="form-input" name="employeeId" value="${escapeHtml(user.employeeId || '')}" /></label></div>
          <label>Address<textarea class="form-textarea" name="address" rows="2" required>${escapeHtml(user.address)}</textarea></label>
          <div class="form-row"><label>Department<input class="form-input" name="department" value="${escapeHtml(user.department)}" required /></label><label>Designation<input class="form-input" name="designation" value="${escapeHtml(user.designation)}" required /></label></div>
          <div class="form-row"><label>Emergency contact<input class="form-input" name="emergencyContactName" value="${escapeHtml(user.emergencyContactName)}" required /></label><label>Emergency phone<input class="form-input" name="emergencyContactPhone" value="${escapeHtml(user.emergencyContactPhone)}" required /></label></div>
          <button class="btn btn-primary" type="submit">${createIcon('save')} Save profile</button>
        </form>
      </section>
      <section class="card card-elevated account-security-card"><div class="card-header"><h3 class="card-title">Security</h3></div>
        <div class="account-role-summary"><span class="badge badge-active">${escapeHtml(user.status)}</span><strong>${escapeHtml(user.role.replaceAll('_',' '))}</strong><small>Account role and status</small></div>
        <form id="password-form" class="auth-form">
          <label>Current password<input class="form-input" type="password" name="currentPassword" autocomplete="current-password" required /></label>
          <label>New password<input class="form-input" type="password" name="newPassword" minlength="10" autocomplete="new-password" required /></label>
          <label>Confirm new password<input class="form-input" type="password" name="confirmPassword" minlength="10" autocomplete="new-password" required /></label>
          <p class="form-hint">At least 10 characters with uppercase, lowercase, and a number.</p>
          <button class="btn btn-secondary" type="submit">Change password</button>
        </form>
      </section>
    </div></div>`;

  container.querySelector('#mobile-menu-btn')?.addEventListener('click', toggleMobileSidebar);
  container.querySelector('#profile-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const form = new FormData(event.currentTarget);
      const file = form.get('profilePictureFile');
      const payload = Object.fromEntries([...form.entries()].filter(([key]) => key !== 'profilePictureFile'));
      if (file?.size) payload.profilePicture = (await uploadImage(file, 'profiles')).url;
      const result = await authRequest('/auth/profile', { method: 'PATCH', body: JSON.stringify(payload) });
      setCurrentUser(result.user);
      toast.success(result.message);
      renderProfile();
    } catch (error) { toast.error(error.message); button.disabled = false; }
  });

  container.querySelector('#password-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get('newPassword') !== form.get('confirmPassword')) return toast.warning('New passwords do not match');
    try {
      const result = await authRequest('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: form.get('currentPassword'), newPassword: form.get('newPassword') }) });
      toast.success(result.message + '. Please sign in again.');
      setTimeout(() => { window.location.hash = '/login'; window.location.reload(); }, 1200);
    } catch (error) { toast.error(error.message); }
  });
}
