import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let memoryServer;
let server;
let baseUrl;
let User;

const password = "AuditPassword123";
const profile = {
  phone: "03000000000",
  dateOfBirth: "1992-02-02",
  gender: "prefer_not_to_say",
  address: "286 H-1, Johar Town",
  city: "Lahore",
  department: "Sales",
  designation: "Sales Executive",
  emergencyContactName: "Emergency Contact",
  emergencyContactPhone: "03111111111",
};

async function request(
  path,
  { method = "GET", cookie, body, headers = {} } = {},
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data =
    response.status === 204 ? null : await response.json().catch(() => ({}));
  return {
    status: response.status,
    data,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}

async function login(email) {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  assert.equal(result.status, 200, result.data?.error);
  return result.cookie;
}

async function createActiveUser({ firstName, email, role, cnic }) {
  return User.create({
    ...profile,
    firstName,
    lastName: "Audit",
    email,
    cnic,
    role,
    status: "active",
    approvedAt: new Date(),
    passwordHash: await bcrypt.hash(password, 4),
  });
}

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = memoryServer.getUri();
  process.env.JWT_SECRET =
    "test-only-jwt-secret-that-is-longer-than-32-characters";
  process.env.SUPER_ADMIN_EMAIL = "superadmin@skyland.test";
  process.env.SUPER_ADMIN_PASSWORD = password;
  process.env.APP_URL = "http://localhost.test";
  process.env.BREVO_API_KEY = "test-brevo-key";
  process.env.EMAIL_DISABLED = "1";
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  process.env.CLOUDINARY_API_KEY = "123456";
  process.env.CLOUDINARY_API_SECRET = "test-cloudinary-secret";
  process.env.VERCEL = "1";
  process.env.NODE_ENV = "test";

  const [{ default: app }, userModule] = await Promise.all([
    import("../server/index.js"),
    import("../server/models/User.js"),
  ]);
  User = userModule.User;
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await request("/api/health")).status, 200);
  assert.equal((await request("/api/auth/me")).status, 401);
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
});

test("registration remains pending until a super admin approves it", async () => {
  const registration = await request("/api/auth/register", {
    method: "POST",
    body: {
      ...profile,
      firstName: "Pending",
      lastName: "Manager",
      email: "pending.manager@skyland.test",
      cnic: "AUDIT-PENDING-MANAGER",
      role: "manager",
      password,
      profilePicture:
        "https://res.cloudinary.com/test-cloud/image/upload/skyland/profiles/audit.jpg",
    },
  });
  assert.equal(registration.status, 201);
  assert.equal(registration.data.user.status, "pending");
  assert.equal(
    (
      await request("/api/auth/login", {
        method: "POST",
        body: { email: "pending.manager@skyland.test", password },
      })
    ).status,
    403,
  );

  const superCookie = await login("superadmin@skyland.test");
  const approved = await request(
    `/api/users/${registration.data.user.id}/approval`,
    { method: "PATCH", cookie: superCookie, body: { status: "active" } },
  );
  assert.equal(approved.status, 200);
  assert.ok(await login("pending.manager@skyland.test"));
});

test("approved legacy accounts recover verification without bypassing new unverified accounts", async () => {
  const approvedAt = new Date("2026-08-01T00:00:00.000Z");
  await User.collection.insertOne({
    ...profile,
    dateOfBirth: new Date(profile.dateOfBirth),
    firstName: "Legacy",
    lastName: "Employee",
    email: "legacy.employee@skyland.test",
    cnic: "AUDIT-LEGACY-EMPLOYEE",
    role: "employee",
    status: "active",
    approvedAt,
    passwordHash: await bcrypt.hash(password, 4),
    createdAt: approvedAt,
    updatedAt: approvedAt,
  });
  await createActiveUser({
    firstName: "Unverified",
    email: "unverified.employee@skyland.test",
    role: "employee",
    cnic: "AUDIT-UNVERIFIED-EMPLOYEE",
  });

  process.env.EMAIL_DISABLED = "0";
  try {
    const legacyLogin = await request("/api/auth/login", {
      method: "POST",
      body: { email: "legacy.employee@skyland.test", password },
    });
    assert.equal(legacyLogin.status, 200, JSON.stringify(legacyLogin.data));
    const repaired = await User.collection.findOne({
      email: "legacy.employee@skyland.test",
    });
    assert.deepEqual(repaired.emailVerifiedAt, approvedAt);

    const unverifiedLogin = await request("/api/auth/login", {
      method: "POST",
      body: { email: "unverified.employee@skyland.test", password },
    });
    assert.equal(unverifiedLogin.status, 403);
    assert.equal(unverifiedLogin.data.error.code, "EMAIL_UNVERIFIED");
    const resendWithStaleCookie = await request(
      "/api/auth/resend-verification",
      {
        method: "POST",
        cookie: "skyland_session=stale",
        headers: { Origin: "http://localhost.test" },
        body: { email: "missing@skyland.test" },
      },
    );
    assert.equal(resendWithStaleCookie.status, 200);
  } finally {
    process.env.EMAIL_DISABLED = "1";
  }
});

test("catalog and settings permissions follow the role matrix", async () => {
  await createActiveUser({
    firstName: "Admin",
    email: "admin@skyland.test",
    role: "admin",
    cnic: "AUDIT-ADMIN",
  });
  await createActiveUser({
    firstName: "Employee",
    email: "employee@skyland.test",
    role: "employee",
    cnic: "AUDIT-EMPLOYEE",
  });
  const [adminCookie, managerCookie, employeeCookie] = await Promise.all([
    login("admin@skyland.test"),
    login("pending.manager@skyland.test"),
    login("employee@skyland.test"),
  ]);

  const product = await request("/api/products", {
    method: "POST",
    cookie: managerCookie,
    body: {
      name: "Audit Panel",
      category: "solar-panel",
      unitPrice: 30000,
      stockQuantity: 999,
    },
  });
  assert.equal(product.status, 201);
  assert.equal(product.data.stockQuantity, undefined);
  assert.equal(
    (
      await request("/api/products", {
        method: "POST",
        cookie: managerCookie,
        body: {
          name: "Invalid category",
          category: "stock-room",
          unitPrice: 1,
        },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`/api/products/${product.data.id}`, {
        method: "DELETE",
        cookie: managerCookie,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(`/api/products/${product.data.id}`, {
        method: "DELETE",
        cookie: employeeCookie,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(`/api/products/${product.data.id}`, {
        method: "DELETE",
        cookie: adminCookie,
      })
    ).status,
    200,
  );

  assert.equal(
    (
      await request("/api/settings", {
        method: "POST",
        cookie: managerCookie,
        body: { key: "validityDays", value: 14 },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/api/settings", {
        method: "POST",
        cookie: managerCookie,
        body: { key: "companyName", value: "Changed" },
      })
    ).status,
    403,
  );
});

test("super admin can grant and revoke individual manager or employee access", async () => {
  const employee = await User.findOne({ email: "employee@skyland.test" });
  const [superCookie, originalEmployeeCookie] = await Promise.all([
    login("superadmin@skyland.test"),
    login("employee@skyland.test"),
  ]);
  const teamList = await request("/api/users", { cookie: superCookie });
  assert.equal(teamList.status, 200);
  const listedEmployee = teamList.data.find((user) => user.id === employee.id);
  assert.equal(listedEmployee.email, "employee@skyland.test");
  assert.equal(listedEmployee.cnic, undefined);
  assert.equal(listedEmployee.effectivePermissions.products_manage, false);
  const employeeDetails = await request(`/api/users/${employee.id}`, {
    cookie: superCookie,
  });
  assert.equal(employeeDetails.status, 200);
  assert.equal(employeeDetails.data.cnic, "AUDIT-EMPLOYEE");
  assert.equal(
    (
      await request("/api/products", {
        method: "POST",
        cookie: originalEmployeeCookie,
        body: { name: "Blocked Product", category: "other", unitPrice: 100 },
      })
    ).status,
    403,
  );

  const permissions = {
    products_manage: true,
    products_delete: false,
    rates_view: true,
    rates_manage: true,
    customers_manage_all: false,
    customers_delete: false,
    quotations_manage_all: false,
    quotations_delete: false,
    quotations_send_all: false,
    settings_manage: false,
  };
  const granted = await request(`/api/users/${employee.id}/permissions`, {
    method: "PATCH",
    cookie: superCookie,
    body: { permissions },
  });
  assert.equal(granted.status, 200);
  assert.equal(granted.data.user.effectivePermissions.products_manage, true);
  assert.equal(
    (
      await request("/api/products", {
        method: "POST",
        cookie: originalEmployeeCookie,
        body: {
          name: "Expired Session Product",
          category: "other",
          unitPrice: 100,
        },
      })
    ).status,
    401,
  );

  const employeeCookie = await login("employee@skyland.test");
  const product = await request("/api/products", {
    method: "POST",
    cookie: employeeCookie,
    body: { name: "Granted Product", category: "other", unitPrice: 100 },
  });
  assert.equal(product.status, 201);
  assert.equal(
    (
      await request(`/api/products/${product.data.id}/rate`, {
        method: "PATCH",
        cookie: employeeCookie,
        body: { unitPrice: 250 },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/api/products/${product.data.id}`, {
        method: "DELETE",
        cookie: employeeCookie,
      })
    ).status,
    403,
  );

  assert.equal(
    (
      await request(`/api/users/${employee.id}/permissions`, {
        method: "PATCH",
        cookie: superCookie,
        body: { permissions: {} },
      })
    ).status,
    200,
  );
  const revokedCookie = await login("employee@skyland.test");
  assert.equal(
    (
      await request("/api/products", {
        method: "POST",
        cookie: revokedCookie,
        body: { name: "Revoked Product", category: "other", unitPrice: 100 },
      })
    ).status,
    403,
  );
  await mongoose.connection
    .collection("products")
    .deleteOne({ _id: new mongoose.Types.ObjectId(product.data.id) });
});

test("quotation totals, ownership, references, and linked deletes are protected", async () => {
  await createActiveUser({
    firstName: "Second",
    email: "second.employee@skyland.test",
    role: "employee",
    cnic: "AUDIT-EMPLOYEE-2",
  });
  const [employeeCookie, secondEmployeeCookie, managerCookie] =
    await Promise.all([
      login("employee@skyland.test"),
      login("second.employee@skyland.test"),
      login("pending.manager@skyland.test"),
    ]);

  const customer = await request("/api/customers", {
    method: "POST",
    cookie: employeeCookie,
    body: {
      name: "Integration Customer",
      email: "customer@example.com",
      phone: "03001234567",
      city: "Lahore",
    },
  });
  assert.equal(customer.status, 201);
  const quoteBody = {
    quotationNumber: "IC-SLE-260811-120000",
    customerId: customer.data.id,
    templateId: "",
    systemSize: 10,
    systemType: "ongrid",
    disco: "LESCO",
    sanctionedLoad: 10,
    prosumerIncluded: true,
    items: [
      {
        productId: "catalog-panel",
        name: "Selected Solar Panel",
        category: "solar-panel",
        quantity: 2,
        unitPrice: 50000,
        total: 1,
      },
      {
        productId: "catalog-battery",
        name: "Selected Battery",
        category: "battery",
        quantity: 3,
        unitPrice: 10000,
        total: 1,
      },
    ],
    subtotal: 1,
    grandTotal: 1,
    discount: 10,
    discountType: "percent",
    taxLabel: "Applicable taxes",
    taxRate: 10,
    paymentSchedule: [
      { label: "Advance", percent: 20 },
      { label: "Installation", percent: 70 },
      { label: "Commissioning", percent: 10 },
    ],
  };
  const quote = await request("/api/quotations", {
    method: "POST",
    cookie: employeeCookie,
    body: quoteBody,
  });
  assert.equal(quote.status, 201);
  assert.equal(quote.data.subtotal, 130000);
  assert.equal(quote.data.taxAmount, 11700);
  assert.equal(quote.data.grandTotal, 128700);
  assert.equal(quote.data.templateId, null);
  const invalidTemplate = await request("/api/quotations", {
    method: "POST",
    cookie: employeeCookie,
    body: {
      ...quoteBody,
      quotationNumber: "IC-SLE-BAD-TEMPLATE",
      templateId: "not-an-object-id",
    },
  });
  assert.equal(invalidTemplate.status, 400);
  assert.equal(invalidTemplate.data.error.code, "TEMPLATE_INVALID");
  assert.equal(
    (
      await request("/api/quotations", {
        method: "POST",
        cookie: employeeCookie,
        body: {
          ...quoteBody,
          quotationNumber: "IC-SLE-OVERLOAD",
          systemSize: 11,
        },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/quotations", {
        method: "POST",
        cookie: employeeCookie,
        body: {
          ...quoteBody,
          quotationNumber: "IC-SLE-BADPAY",
          paymentSchedule: [{ label: "Advance", percent: 80 }],
        },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/quotations", {
        method: "POST",
        cookie: employeeCookie,
        body: quoteBody,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(`/api/customers/${customer.data.id}`, {
        method: "DELETE",
        cookie: managerCookie,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(`/api/quotations/${quote.data.id}`, {
        method: "PUT",
        cookie: secondEmployeeCookie,
        body: { status: "sent" },
      })
    ).status,
    403,
  );
  const emailed = await request("/api/email/send-quotation", {
    method: "POST",
    cookie: employeeCookie,
    body: { quotationId: quote.data.id },
  });
  assert.equal(emailed.status, 200);
  assert.equal(emailed.data.status, "sent");
  const invalidEmailTarget = await request("/api/email/send-quotation", {
    method: "POST",
    cookie: employeeCookie,
    body: { quotationId: "not-an-object-id" },
  });
  assert.equal(invalidEmailTarget.status, 400);
  assert.equal(invalidEmailTarget.data.error.code, "QUOTATION_INVALID");
  assert.equal(
    (
      await request("/api/email/send-quotation", {
        method: "POST",
        cookie: secondEmployeeCookie,
        body: { quotationId: quote.data.id },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(`/api/quotations/${quote.data.id}`, {
        method: "DELETE",
        cookie: employeeCookie,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(`/api/quotations/${quote.data.id}`, {
        method: "PUT",
        cookie: managerCookie,
        body: { status: "accepted" },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(`/api/quotations/${quote.data.id}/status`, {
        method: "PATCH",
        cookie: managerCookie,
        body: { status: "accepted" },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/api/quotations/${quote.data.id}`, {
        method: "DELETE",
        cookie: managerCookie,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/api/customers/${customer.data.id}`, {
        method: "DELETE",
        cookie: managerCookie,
      })
    ).status,
    200,
  );
});

test("employee list and direct record access are limited to owned or assigned work", async () => {
  const [employeeCookie, secondEmployeeCookie] = await Promise.all([
    login("employee@skyland.test"),
    login("second.employee@skyland.test"),
  ]);
  const customer = await request("/api/customers", {
    method: "POST",
    cookie: employeeCookie,
    body: {
      name: "Private Customer",
      email: "private@example.com",
      phone: "03009999999",
      city: "Lahore",
    },
  });
  assert.equal(customer.status, 201);
  const ownList = await request("/api/customers?page=1&limit=10", {
    cookie: employeeCookie,
  });
  assert.equal(ownList.status, 200);
  assert.ok(ownList.data.items.some((row) => row.id === customer.data.id));
  const otherList = await request("/api/customers?page=1&limit=10", {
    cookie: secondEmployeeCookie,
  });
  assert.equal(otherList.status, 200);
  assert.ok(!otherList.data.items.some((row) => row.id === customer.data.id));
  assert.equal(
    (
      await request(`/api/customers/${customer.data.id}`, {
        cookie: secondEmployeeCookie,
      })
    ).status,
    404,
  );
});

test("sessions are listed and can be remotely revoked", async () => {
  const firstCookie = await login("employee@skyland.test");
  const secondCookie = await login("employee@skyland.test");
  const sessions = await request("/api/auth/sessions", { cookie: firstCookie });
  assert.equal(sessions.status, 200);
  const other = sessions.data.find((row) => !row.current);
  assert.ok(other);
  assert.equal(
    (
      await request(`/api/auth/sessions/${other.id}`, {
        method: "DELETE",
        cookie: firstCookie,
      })
    ).status,
    204,
  );
  assert.equal(
    (await request("/api/auth/me", { cookie: secondCookie })).status,
    401,
  );
});

test("paginated catalog responses and quotation approval revisions are available", async () => {
  const [employeeCookie, managerCookie] = await Promise.all([
    login("employee@skyland.test"),
    login("pending.manager@skyland.test"),
  ]);
  const catalog = await request("/api/products?page=1&limit=5&sort=name", {
    cookie: employeeCookie,
  });
  assert.equal(catalog.status, 200);
  assert.equal(catalog.data.items.length, 5);
  assert.ok(catalog.data.meta.total >= 20);

  const customer = await request("/api/customers", {
    method: "POST",
    cookie: employeeCookie,
    body: {
      name: "Approval Customer",
      phone: "03008888888",
      city: "Islamabad",
    },
  });
  const reference = `SLE-APPROVAL-${Date.now()}`;
  const quotation = await request("/api/quotations", {
    method: "POST",
    cookie: employeeCookie,
    body: {
      quotationNumber: reference,
      customerId: customer.data.id,
      systemSize: 5,
      systemType: "ongrid",
      items: [
        {
          name: "Solar installation package",
          category: "service",
          quantity: 1,
          unitPrice: 500000,
        },
      ],
      subtotal: 500000,
      grandTotal: 500000,
      discount: 0,
      discountType: "percent",
      taxRate: 0,
    },
  });
  assert.equal(quotation.status, 201);
  assert.equal(
    (
      await request(`/api/quotations/${quotation.data.id}/approval`, {
        method: "POST",
        cookie: employeeCookie,
        body: { note: "Please review" },
      })
    ).status,
    200,
  );
  const bypassApproval = await request(
    `/api/quotations/${quotation.data.id}/status`,
    {
      method: "PATCH",
      cookie: managerCookie,
      body: { status: "approved" },
    },
  );
  assert.equal(bypassApproval.status, 409);
  assert.equal(bypassApproval.data.error.code, "APPROVAL_ENDPOINT_REQUIRED");
  const approved = await request(
    `/api/quotations/${quotation.data.id}/approval`,
    {
      method: "PATCH",
      cookie: managerCookie,
      body: { decision: "approved", note: "Approved" },
    },
  );
  assert.equal(approved.status, 200);
  assert.equal(approved.data.status, "approved");
  const revision = await request(
    `/api/quotations/${quotation.data.id}/revisions`,
    { method: "POST", cookie: employeeCookie, body: {} },
  );
  assert.equal(revision.status, 201);
  assert.equal(revision.data.revision, 2);
});
