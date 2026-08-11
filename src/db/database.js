// ============================================
// SKYLAND ENERGY — Real-Time MongoDB Database Layer
// Connects to Express API / MongoDB Atlas with IndexedDB fallback
// ============================================
import { openDB } from 'idb';

const API_BASE = '/api';
const DB_NAME = 'skyland-quotation-system';
const DB_VERSION = 1;

let dbInstance = null;
let settingsCache = null;
let settingsCacheTime = 0;
let settingsRequest = null;

export async function getDB() {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('products')) {
        const productStore = db.createObjectStore('products', { keyPath: 'id' });
        productStore.createIndex('category', 'category');
      }
      if (!db.objectStoreNames.contains('customers')) {
        db.createObjectStore('customers', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('quotations')) {
        db.createObjectStore('quotations', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    },
  });

  return dbInstance;
}

// Helper API fetch
async function apiFetch(endpoint, options = {}) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `API Error: ${res.statusText}`);
    }
    return res.status === 204 ? null : await res.json();
}

// ---- Products CRUD ----
export async function getAllProducts() {
  const remote = await apiFetch('/products');
  if (remote) {
    // Sync local DB cache
    try {
      const db = await getDB();
      const tx = db.transaction('products', 'readwrite');
      await tx.store.clear();
      for (const p of remote) {
        await tx.store.put(p);
      }
      await tx.done;
    } catch (e) { console.warn('Cache sync error:', e); }
    return remote;
  }
  // Fallback to IndexedDB
  const db = await getDB();
  return db.getAll('products');
}

export async function getProductsByCategory(category) {
  const products = await getAllProducts();
  return products.filter(p => p.category === category);
}

export async function getProduct(id) {
  const remote = await apiFetch(`/products/${id}`);
  if (remote) return remote;
  const db = await getDB();
  return db.get('products', id);
}

export async function addProduct(product) {
  const remote = await apiFetch('/products', {
    method: 'POST',
    body: JSON.stringify(product),
  });
  if (remote) {
    const db = await getDB();
    await db.put('products', remote);
    return remote.id;
  }
  // Local fallback
  const db = await getDB();
  const data = { ...product, id: Date.now().toString() };
  await db.put('products', data);
  return data.id;
}

export async function updateProduct(id, product) {
  const remote = await apiFetch(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(product),
  });
  if (remote) {
    const db = await getDB();
    await db.put('products', remote);
    return remote;
  }
  // Local fallback
  const db = await getDB();
  const existing = await db.get('products', id);
  const data = { ...existing, ...product, id };
  await db.put('products', data);
  return data;
}

export async function deleteProduct(id) {
  const remote = await apiFetch(`/products/${id}`, { method: 'DELETE' });
  const db = await getDB();
  await db.delete('products', id);
  return remote || { id };
}

// ---- Customers CRUD ----
export async function getAllCustomers() {
  const remote = await apiFetch('/customers');
  if (remote) {
    try {
      const db = await getDB();
      const tx = db.transaction('customers', 'readwrite');
      await tx.store.clear();
      for (const c of remote) {
        await tx.store.put(c);
      }
      await tx.done;
    } catch (e) { console.warn('Cache sync error:', e); }
    return remote;
  }
  const db = await getDB();
  return db.getAll('customers');
}

export async function getCustomer(id) {
  const remote = await apiFetch(`/customers/${id}`);
  if (remote) return remote;
  const db = await getDB();
  return db.get('customers', id);
}

export async function addCustomer(customer) {
  const remote = await apiFetch('/customers', {
    method: 'POST',
    body: JSON.stringify(customer),
  });
  if (remote) {
    const db = await getDB();
    await db.put('customers', remote);
    return remote.id;
  }
  const db = await getDB();
  const data = { ...customer, id: Date.now().toString() };
  await db.put('customers', data);
  return data.id;
}

export async function updateCustomer(id, customer) {
  const remote = await apiFetch(`/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(customer),
  });
  if (remote) {
    const db = await getDB();
    await db.put('customers', remote);
    return remote;
  }
  const db = await getDB();
  const existing = await db.get('customers', id);
  const data = { ...existing, ...customer, id };
  await db.put('customers', data);
  return data;
}

export async function deleteCustomer(id) {
  const remote = await apiFetch(`/customers/${id}`, { method: 'DELETE' });
  const db = await getDB();
  await db.delete('customers', id);
  return remote || { id };
}

// ---- Quotations CRUD ----
export async function getAllQuotations() {
  const remote = await apiFetch('/quotations');
  if (remote) {
    try {
      const db = await getDB();
      const tx = db.transaction('quotations', 'readwrite');
      await tx.store.clear();
      for (const q of remote) {
        await tx.store.put(q);
      }
      await tx.done;
    } catch (e) { console.warn('Cache sync error:', e); }
    return remote;
  }
  const db = await getDB();
  return db.getAll('quotations');
}

export async function getQuotation(id) {
  const remote = await apiFetch(`/quotations/${id}`);
  if (remote) return remote;
  const db = await getDB();
  return db.get('quotations', id);
}

export async function getQuotationsByCustomer(customerId) {
  const quotations = await getAllQuotations();
  return quotations.filter(q => q.customerId === customerId);
}

export async function getQuotationsByStatus(status) {
  const quotations = await getAllQuotations();
  return quotations.filter(q => q.status === status);
}

export async function addQuotation(quotation) {
  const remote = await apiFetch('/quotations', {
    method: 'POST',
    body: JSON.stringify(quotation),
  });
  if (remote) {
    const db = await getDB();
    await db.put('quotations', remote);
    return remote.id;
  }
  const db = await getDB();
  const data = { ...quotation, id: Date.now().toString() };
  await db.put('quotations', data);
  return data.id;
}

export async function updateQuotation(id, quotation) {
  const remote = await apiFetch(`/quotations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(quotation),
  });
  if (remote) {
    const db = await getDB();
    await db.put('quotations', remote);
    return remote;
  }
  const db = await getDB();
  const existing = await db.get('quotations', id);
  const data = { ...existing, ...quotation, id };
  await db.put('quotations', data);
  return data;
}

export async function deleteQuotation(id) {
  const remote = await apiFetch(`/quotations/${id}`, { method: 'DELETE' });
  const db = await getDB();
  await db.delete('quotations', id);
  return remote || { id };
}

// ---- Settings ----
export async function getAllSettings({ fresh = false } = {}) {
  if (!fresh && settingsCache && Date.now() - settingsCacheTime < 60_000) return settingsCache;
  if (settingsRequest) return settingsRequest;

  settingsRequest = apiFetch('/settings')
    .then(rows => {
      settingsCache = Object.fromEntries((rows || []).map(row => [row.key, row.value]));
      settingsCacheTime = Date.now();
      return settingsCache;
    })
    .finally(() => { settingsRequest = null; });
  return settingsRequest;
}

export async function getSetting(key) {
  const settings = await getAllSettings();
  return settings[key] ?? null;
}

export async function setSetting(key, value) {
  const remote = await apiFetch('/settings', {
    method: 'POST',
    body: JSON.stringify({ key, value }),
  });
  const db = await getDB();
  await db.put('settings', { key, value });
  settingsCache = { ...(settingsCache || {}), [key]: value };
  settingsCacheTime = Date.now();
  return remote || { key, value };
}

// ---- Email via Brevo ----
export async function sendQuotationEmail(quotationId) {
  return apiFetch('/email/send-quotation', {
    method: 'POST',
    body: JSON.stringify({ quotationId }),
  });
}

// ---- Data Export/Import ----
export async function exportAllData() {
  const [products, customers, quotations, settings] = await Promise.all([
    getAllProducts(),
    getAllCustomers(),
    getAllQuotations(),
    apiFetch('/settings') || (await getDB()).getAll('settings'),
  ]);

  return {
    products,
    customers,
    quotations,
    settings,
    exportedAt: new Date().toISOString(),
  };
}

export async function importAllData(data) {
  if (!data || !Array.isArray(data.products) || !Array.isArray(data.customers) || !Array.isArray(data.quotations)) {
    throw new Error('Backup must contain products, customers, and quotations arrays');
  }
  const productIds = new Map();
  const customerIds = new Map();
  for (const source of data.products) {
    const oldId = source.id || source._id;
    const p = { ...source };
    delete p._id; delete p.id; delete p.createdBy; delete p.updatedBy;
    const newId = await addProduct(p);
    if (oldId) productIds.set(String(oldId), newId);
  }
  for (const source of data.customers) {
    const oldId = source.id || source._id;
    const c = { ...source };
    delete c._id; delete c.id; delete c.createdBy; delete c.updatedBy;
    const newId = await addCustomer(c);
    if (oldId) customerIds.set(String(oldId), newId);
  }
  for (const source of data.quotations) {
    const q = { ...source };
    delete q._id; delete q.id; delete q.createdBy; delete q.updatedBy; delete q.statusHistory;
    q.customerId = customerIds.get(String(source.customerId)) || source.customerId;
    q.items = (source.items || []).map(item => ({ ...item, productId: productIds.get(String(item.productId)) || item.productId || '' }));
    await addQuotation(q);
  }
}

export async function clearAllData() {
  const quotations = await getAllQuotations();
  for (const q of quotations) await deleteQuotation(q.id);

  const customers = await getAllCustomers();
  for (const c of customers) await deleteCustomer(c.id);

  const products = await getAllProducts();
  for (const p of products) await deleteProduct(p.id);
}
