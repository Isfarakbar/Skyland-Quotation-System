let currentUser = null;

export async function authRequest(endpoint, options = {}) {
  const isForm = options.body instanceof FormData;
  const response = await fetch(`/api${endpoint}`, {
    credentials: 'same-origin',
    ...options,
    headers: isForm ? options.headers : { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
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
    throw new Error(data?.error || fallback);
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
  await authRequest('/auth/logout', { method: 'POST' });
  currentUser = null;
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
