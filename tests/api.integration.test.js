import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let memoryServer;
let server;
let baseUrl;
let User;

const password = 'AuditPassword123';
const profile = {
  phone: '03000000000',
  dateOfBirth: '1992-02-02',
  gender: 'prefer_not_to_say',
  address: '286 H-1, Johar Town',
  city: 'Lahore',
  department: 'Sales',
  designation: 'Sales Executive',
  emergencyContactName: 'Emergency Contact',
  emergencyContactPhone: '03111111111',
};

async function request(path, { method = 'GET', cookie, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

async function login(email) {
  const result = await request('/api/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(result.status, 200, result.data?.error);
  return result.cookie;
}

async function createActiveUser({ firstName, email, role, cnic }) {
  return User.create({
    ...profile,
    firstName,
    lastName: 'Audit',
    email,
    cnic,
    role,
    status: 'active',
    approvedAt: new Date(),
    passwordHash: await bcrypt.hash(password, 4),
  });
}

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = memoryServer.getUri();
  process.env.JWT_SECRET = 'test-only-jwt-secret-that-is-longer-than-32-characters';
  process.env.SUPER_ADMIN_EMAIL = 'superadmin@skyland.test';
  process.env.SUPER_ADMIN_PASSWORD = password;
  process.env.APP_URL = 'http://localhost.test';
  process.env.BREVO_API_KEY = 'test-brevo-key';
  process.env.EMAIL_DISABLED = '1';
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
  process.env.CLOUDINARY_API_KEY = '123456';
  process.env.CLOUDINARY_API_SECRET = 'test-cloudinary-secret';
  process.env.VERCEL = '1';
  process.env.NODE_ENV = 'test';

  const [{ default: app }, userModule] = await Promise.all([
    import('../server/index.js'),
    import('../server/models/User.js'),
  ]);
  User = userModule.User;
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await request('/api/health')).status, 200);
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
});

test('registration remains pending until a super admin approves it', async () => {
  const registration = await request('/api/auth/register', {
    method: 'POST',
    body: {
      ...profile,
      firstName: 'Pending',
      lastName: 'Manager',
      email: 'pending.manager@skyland.test',
      cnic: 'AUDIT-PENDING-MANAGER',
      role: 'manager',
      password,
      profilePicture: 'https://res.cloudinary.com/demo/image/upload/audit.jpg',
    },
  });
  assert.equal(registration.status, 201);
  assert.equal(registration.data.user.status, 'pending');
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { email: 'pending.manager@skyland.test', password } })).status, 403);

  const superCookie = await login('superadmin@skyland.test');
  const approved = await request(`/api/users/${registration.data.user.id}/approval`, { method: 'PATCH', cookie: superCookie, body: { status: 'active' } });
  assert.equal(approved.status, 200);
  assert.ok(await login('pending.manager@skyland.test'));
});

test('catalog and settings permissions follow the role matrix', async () => {
  await createActiveUser({ firstName: 'Admin', email: 'admin@skyland.test', role: 'admin', cnic: 'AUDIT-ADMIN' });
  await createActiveUser({ firstName: 'Employee', email: 'employee@skyland.test', role: 'employee', cnic: 'AUDIT-EMPLOYEE' });
  const [adminCookie, managerCookie, employeeCookie] = await Promise.all([
    login('admin@skyland.test'), login('pending.manager@skyland.test'), login('employee@skyland.test'),
  ]);

  const product = await request('/api/products', { method: 'POST', cookie: managerCookie, body: { name: 'Audit Panel', category: 'solar-panel', unitPrice: 30000, stockQuantity: 999 } });
  assert.equal(product.status, 201);
  assert.equal(product.data.stockQuantity, undefined);
  assert.equal((await request('/api/products', { method: 'POST', cookie: managerCookie, body: { name: 'Invalid category', category: 'stock-room', unitPrice: 1 } })).status, 400);
  assert.equal((await request(`/api/products/${product.data.id}`, { method: 'DELETE', cookie: managerCookie })).status, 403);
  assert.equal((await request(`/api/products/${product.data.id}`, { method: 'DELETE', cookie: employeeCookie })).status, 403);
  assert.equal((await request(`/api/products/${product.data.id}`, { method: 'DELETE', cookie: adminCookie })).status, 200);

  assert.equal((await request('/api/settings', { method: 'POST', cookie: managerCookie, body: { key: 'validityDays', value: 14 } })).status, 200);
  assert.equal((await request('/api/settings', { method: 'POST', cookie: managerCookie, body: { key: 'companyName', value: 'Changed' } })).status, 403);
});

test('quotation totals, ownership, references, and linked deletes are protected', async () => {
  await createActiveUser({ firstName: 'Second', email: 'second.employee@skyland.test', role: 'employee', cnic: 'AUDIT-EMPLOYEE-2' });
  const [employeeCookie, secondEmployeeCookie, managerCookie] = await Promise.all([
    login('employee@skyland.test'), login('second.employee@skyland.test'), login('pending.manager@skyland.test'),
  ]);

  const customer = await request('/api/customers', { method: 'POST', cookie: employeeCookie, body: { name: 'Integration Customer', email: 'customer@example.com', phone: '03001234567', city: 'Lahore' } });
  assert.equal(customer.status, 201);
  const quoteBody = {
    quotationNumber: 'IC-SLE-260811-120000',
    customerId: customer.data.id,
    systemSize: 10,
    systemType: 'ongrid',
    disco: 'LESCO',
    sanctionedLoad: 10,
    prosumerIncluded: true,
    items: [
      { productId: 'catalog-panel', name: 'Selected Solar Panel', category: 'solar-panel', quantity: 2, unitPrice: 50000, total: 1 },
      { productId: 'catalog-battery', name: 'Selected Battery', category: 'battery', quantity: 3, unitPrice: 10000, total: 1 },
    ],
    subtotal: 1,
    grandTotal: 1,
    discount: 10,
    discountType: 'percent',
    taxLabel: 'Applicable taxes',
    taxRate: 10,
    paymentSchedule: [
      { label: 'Advance', percent: 20 },
      { label: 'Installation', percent: 70 },
      { label: 'Commissioning', percent: 10 },
    ],
  };
  const quote = await request('/api/quotations', { method: 'POST', cookie: employeeCookie, body: quoteBody });
  assert.equal(quote.status, 201);
  assert.equal(quote.data.subtotal, 130000);
  assert.equal(quote.data.taxAmount, 11700);
  assert.equal(quote.data.grandTotal, 128700);
  assert.equal((await request('/api/quotations', { method: 'POST', cookie: employeeCookie, body: { ...quoteBody, quotationNumber: 'IC-SLE-OVERLOAD', systemSize: 11 } })).status, 400);
  assert.equal((await request('/api/quotations', { method: 'POST', cookie: employeeCookie, body: { ...quoteBody, quotationNumber: 'IC-SLE-BADPAY', paymentSchedule: [{ label: 'Advance', percent: 80 }] } })).status, 400);
  assert.equal((await request('/api/quotations', { method: 'POST', cookie: employeeCookie, body: quoteBody })).status, 409);
  assert.equal((await request(`/api/customers/${customer.data.id}`, { method: 'DELETE', cookie: managerCookie })).status, 409);
  assert.equal((await request(`/api/quotations/${quote.data.id}`, { method: 'PUT', cookie: secondEmployeeCookie, body: { status: 'sent' } })).status, 403);
  const emailed = await request('/api/email/send-quotation', { method: 'POST', cookie: employeeCookie, body: { quotationId: quote.data.id } });
  assert.equal(emailed.status, 200);
  assert.equal(emailed.data.status, 'sent');
  assert.equal((await request('/api/email/send-quotation', { method: 'POST', cookie: secondEmployeeCookie, body: { quotationId: quote.data.id } })).status, 403);
  assert.equal((await request(`/api/quotations/${quote.data.id}`, { method: 'DELETE', cookie: employeeCookie })).status, 403);
  assert.equal((await request(`/api/quotations/${quote.data.id}`, { method: 'PUT', cookie: managerCookie, body: { status: 'accepted' } })).status, 200);
  assert.equal((await request(`/api/quotations/${quote.data.id}`, { method: 'DELETE', cookie: managerCookie })).status, 200);
  assert.equal((await request(`/api/customers/${customer.data.id}`, { method: 'DELETE', cookie: managerCookie })).status, 200);
});
