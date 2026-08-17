import { authRequest, login, uploadImage } from '../auth.js';
import { navigate } from '../router.js';
import { escapeHtml } from '../utils/helpers.js';
import skylandLogo from '../../Skyland Recreated Logo.svg?url';

function authLayout(title, subtitle, content) {
  const app = document.getElementById('app');
  app.className = 'auth-layout';
  app.innerHTML = `
    <section class="auth-brand-panel">
      <span class="auth-logo-crop"><img src="${skylandLogo}" alt="Skyland Energy" class="auth-logo" /></span>
      <div><p class="auth-eyebrow">SKYLAND ENERGY</p><h1>Solar quotations.<br/>Built for your team.</h1><p>Securely manage customers, products, rates, and professional proposals in one place.</p></div>
    </section>
    <main class="auth-main"><div class="auth-card"><h2>${title}</h2><p class="auth-subtitle">${subtitle}</p>${content}</div></main>`;
  return app.querySelector('.auth-card');
}

function showMessage(card, message, type = 'error') {
  let el = card.querySelector('.auth-message');
  if (!el) { el = document.createElement('div'); el.className = 'auth-message'; card.querySelector('form')?.prepend(el); }
  el.className = `auth-message ${type}`;
  el.textContent = message;
}

export async function renderLogin() {
  const card = authLayout('Welcome back', 'Sign in to your approved Skyland account.', `
    <form class="auth-form" id="login-form">
      <label>Email address<input class="form-input" type="email" name="email" autocomplete="email" required /></label>
      <label>Password<input class="form-input" type="password" name="password" autocomplete="current-password" required /></label>
      <div class="auth-form-row"><a href="#/forgot-password">Forgot password?</a></div>
      <button class="btn btn-primary auth-submit" type="submit">Sign in</button>
    </form>
    <p class="auth-switch">New team member? <a href="#/signup">Request an account</a></p>`);
  card.querySelector('#login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    button.disabled = true; button.textContent = 'Signing in…';
    try {
      const form = new FormData(event.currentTarget);
      await login(form.get('email'), form.get('password'));
      window.location.hash = '/dashboard';
      window.location.reload();
    } catch (error) { showMessage(card, error.message); button.disabled = false; button.textContent = 'Sign in'; }
  });
}

export async function renderSignup() {
  const card = authLayout('Request access', 'Managers and employees require super admin approval.', `
    <form class="auth-form auth-form-wide" id="signup-form">
      <div class="auth-section-title">Account</div>
      <div class="form-row"><label>First name<input class="form-input" name="firstName" required /></label><label>Last name<input class="form-input" name="lastName" required /></label></div>
      <div class="form-row"><label>Email<input class="form-input" type="email" name="email" autocomplete="email" required /></label><label>Role<select class="form-select" name="role" required><option value="employee">Employee</option><option value="manager">Manager</option></select></label></div>
      <div class="form-row"><label>Password<input class="form-input" type="password" name="password" minlength="10" autocomplete="new-password" required /></label><label>Confirm password<input class="form-input" type="password" name="confirmPassword" minlength="10" autocomplete="new-password" required /></label></div>
      <p class="form-hint">Use 10+ characters with uppercase, lowercase, and a number.</p>
      <div class="auth-section-title">Personal information</div>
      <div class="form-row"><label>Phone<input class="form-input" type="tel" name="phone" required /></label><label>Alternate phone<input class="form-input" type="tel" name="alternatePhone" /></label></div>
      <div class="form-row"><label>Date of birth<input class="form-input" type="date" name="dateOfBirth" required /></label><label>Gender<select class="form-select" name="gender" required><option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></select></label></div>
      <div class="form-row"><label>CNIC / identity number<input class="form-input" name="cnic" required /></label><label>City<input class="form-input" name="city" required /></label></div>
      <label>Home address<textarea class="form-textarea" name="address" rows="2" required></textarea></label>
      <div class="auth-section-title">Employment</div>
      <div class="form-row"><label>Department<input class="form-input" name="department" required /></label><label>Designation<input class="form-input" name="designation" required /></label></div>
      <div class="form-row"><label>Employee ID<input class="form-input" name="employeeId" /></label><label>Profile picture<input class="form-input" type="file" name="profilePictureFile" accept="image/jpeg,image/png,image/webp" required /></label></div>
      <div class="auth-section-title">Emergency contact</div>
      <div class="form-row"><label>Contact name<input class="form-input" name="emergencyContactName" required /></label><label>Contact phone<input class="form-input" type="tel" name="emergencyContactPhone" required /></label></div>
      <button class="btn btn-primary auth-submit" type="submit">Submit registration</button>
    </form>
    <p class="auth-switch">Already approved? <a href="#/login">Sign in</a></p>`);
  card.querySelector('#signup-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const form = new FormData(event.currentTarget);
    if (form.get('password') !== form.get('confirmPassword')) return showMessage(card, 'Passwords do not match.');
    button.disabled = true; button.textContent = 'Uploading and submitting…';
    try {
      const file = form.get('profilePictureFile');
      const uploaded = await uploadImage(file, 'profiles', true);
      const payload = Object.fromEntries([...form.entries()].filter(([key]) => !['profilePictureFile', 'confirmPassword'].includes(key)));
      payload.profilePicture = uploaded.url;
      const result = await authRequest('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
      card.innerHTML = `<div class="auth-success-icon">✓</div><h2>Request submitted</h2><p class="auth-subtitle">${escapeHtml(result.message)}</p><a class="btn btn-primary auth-submit" href="#/login">Back to sign in</a>`;
    } catch (error) { showMessage(card, error.message); button.disabled = false; button.textContent = 'Submit registration'; }
  });
}

export async function renderForgotPassword() {
  const card = authLayout('Reset password', 'We will email a secure reset link if the account exists.', `<form class="auth-form" id="forgot-form"><label>Email address<input class="form-input" type="email" name="email" required /></label><button class="btn btn-primary auth-submit">Send reset link</button></form><p class="auth-switch"><a href="#/login">Back to sign in</a></p>`);
  card.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault();
    try { const form = new FormData(event.currentTarget); const result = await authRequest('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: form.get('email') }) }); showMessage(card, result.message, 'success'); }
    catch (error) { showMessage(card, error.message); }
  });
}

export async function renderResetPassword(token) {
  const card = authLayout('Choose a new password', 'Your reset link is valid for 30 minutes.', `<form class="auth-form" id="reset-form"><label>New password<input class="form-input" type="password" name="password" minlength="10" required /></label><label>Confirm password<input class="form-input" type="password" name="confirm" minlength="10" required /></label><button class="btn btn-primary auth-submit">Update password</button></form>`);
  card.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    if (form.get('password') !== form.get('confirm')) return showMessage(card, 'Passwords do not match.');
    try { const result = await authRequest('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password: form.get('password') }) }); showMessage(card, result.message, 'success'); setTimeout(() => navigate('/login'), 1200); }
    catch (error) { showMessage(card, error.message); }
  });
}
