let currentUser = null;

export async function authRequest(endpoint, options = {}) {
  const isForm = options.body instanceof FormData;
  const csrf = document.cookie.split('; ').find(row => row.startsWith('skyland_csrf='))?.split('=').slice(1).join('=');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const response = await fetch(`/api${endpoint}`, {
    credentials: 'same-origin',
    ...options,
    signal: options.signal || controller.signal,
    headers: isForm ? { ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...(options.headers || {}) } : { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...(options.headers || {}) },
  });
  clearTimeout(timeout);
  const responseText = response.status === 204 ? '' : await response.text();
  let data = null;
  if (responseText) {
    try { data = JSON.parse(responseText); }
    catch { data = { error: responseText.trim() }; }
  }
  if (!response.ok) {
    const fallback = response.status >= 500
      ? 'The Skyland server is temporarily unavailable. Please try again shortly.'
      : `Request failed (${response.status})`;
    throw new Error(typeof data?.error === 'string' ? data.error : data?.error?.message || fallback);
  }
  return data;
}

export async function restoreSession() {
  try {
    const data = await authRequest('/auth/me');
    currentUser = data.user;
  } catch (_error) {
    currentUser = null;
  }
  return currentUser;
}

export function getCurrentUser() {
  return currentUser;
}

export function setCurrentUser(user) {
  currentUser = user;
  return currentUser;
}

export async function login(email, password) {
  const data = await authRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  currentUser = data.user;
  return currentUser;
}

export async function logout() {
  currentUser = null;
  await authRequest('/auth/logout', { method: 'POST' });
  indexedDB.deleteDatabase('skyland-quotation-system');
}

export async function uploadImage(file, folder = 'products', registration = false) {
  const body = new FormData();
  body.append('image', file);
  body.append('folder', folder);
  return authRequest(`/uploads/${registration ? 'registration-profile' : 'image'}`, { method: 'POST', body });
}

export function hasRole(...roles) {
  return Boolean(currentUser && roles.includes(currentUser.role));
}

export function hasPermission(permission) {
  if (!currentUser) return false;
  if (currentUser.role === 'super_admin') return true;
  return Boolean(currentUser.effectivePermissions?.[permission]);
}
