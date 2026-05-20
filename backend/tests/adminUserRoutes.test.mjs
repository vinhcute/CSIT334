import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

process.env.AUTH_TOKEN_SECRET = "admin-user-routes-test-secret";
process.env.AUTH_TOKEN_EXPIRES_IN = "1h";

const prisma = new PrismaClient();

const adminUser = {
  name: "Admin Routes Admin",
  universityId: "ADMINROUTES001",
  email: "admin-routes-admin@example.test",
  password: "admin-routes-password",
};

const driverUser = {
  name: "Admin Routes Driver",
  universityId: "ADMINROUTES002",
  email: "admin-routes-driver@example.test",
  password: "driver-routes-password",
  licensePlate: "ADMIN-DRIVER-001",
};

async function cleanup() {
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: adminUser.email },
        { email: driverUser.email },
        { universityId: adminUser.universityId },
        { universityId: driverUser.universityId },
      ],
    },
  });
}

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1");
    server.once("listening", () => resolve(server));
    server.once("error", reject);
  });
}

async function request(app, path, options = {}) {
  const server = await listen(app);

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const body = await response.json();

    return { statusCode: response.status, body };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function createApp() {
  const { createApp } = await import("../dist/index.js");

  return createApp();
}

async function seedUsers() {
  await cleanup();

  const admin = await prisma.user.create({
    data: {
      name: adminUser.name,
      email: adminUser.email,
      universityId: adminUser.universityId,
      passwordHash: await bcrypt.hash(adminUser.password, 12),
      role: "admin",
      accountStatus: "active",
    },
  });
  const driver = await prisma.user.create({
    data: {
      name: driverUser.name,
      email: driverUser.email,
      universityId: driverUser.universityId,
      passwordHash: await bcrypt.hash(driverUser.password, 12),
      role: "driver",
      accountStatus: "active",
      vehicleProfiles: {
        create: {
          licensePlate: driverUser.licensePlate,
          isPrimary: true,
        },
      },
    },
  });
  await prisma.subscription.create({
    data: {
      userId: driver.id,
      type: "monthly",
      status: "active",
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return { admin, driver };
}

async function login(app, email, password) {
  const result = await request(app, "/api/auth/login", {
    method: "POST",
    body: { email, password },
  });

  return result;
}

async function adminToken(app) {
  const result = await login(app, adminUser.email, adminUser.password);

  return result.body.token;
}

async function driverToken(app) {
  const result = await login(app, driverUser.email, driverUser.password);

  return result.body.token;
}

test("Admin can list user account summaries without passwordHash", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const token = await adminToken(app);
    const result = await request(app, "/api/admin/users", {
      headers: { authorization: `Bearer ${token}` },
    });
    const emails = result.body.users.map((user) => user.email);

    assert.equal(result.statusCode, 200);
    assert.equal(emails.includes(adminUser.email), true);
    assert.equal(emails.includes(driverUser.email), true);
    assert.equal(
      result.body.users.some((user) => Object.hasOwn(user, "passwordHash")),
      false,
    );
    assert.equal(
      result.body.users.some((user) => Object.hasOwn(user, "vehicleProfiles")),
      false,
    );
    assert.equal(
      result.body.users.some((user) => Object.hasOwn(user, "licensePlate")),
      false,
    );
    assert.equal(
      result.body.users.some((user) => Object.hasOwn(user, "token")),
      false,
    );
    assert.equal(result.body.pagination.page, 1);
    assert.equal(result.body.pagination.pageSize, 20);
    assert.equal(typeof result.body.pagination.total, "number");
    assert.equal(typeof result.body.pagination.totalPages, "number");
    const driverSummary = result.body.users.find((user) => user.email === driverUser.email);
    assert.deepEqual(Object.keys(driverSummary.subscription).sort(), ["endTime", "status"]);
    assert.equal(driverSummary.subscription.status, "subscribed");
    assert.equal(typeof driverSummary.subscription.endTime, "string");
    assert.equal(typeof driverSummary.universityId, "string");
  } finally {
    await cleanup();
  }
});

test("Admin user summaries treat expired subscriptions as not subscribed", async () => {
  const app = await createApp();
  const { driver } = await seedUsers();

  try {
    await prisma.subscription.deleteMany({ where: { userId: driver.id } });
    await prisma.subscription.create({
      data: {
        userId: driver.id,
        type: "weekly",
        status: "active",
        startTime: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    });
    const token = await adminToken(app);
    const result = await request(app, "/api/admin/users", {
      headers: { authorization: `Bearer ${token}` },
    });
    const driverSummary = result.body.users.find((user) => user.email === driverUser.email);

    assert.equal(result.statusCode, 200);
    assert.deepEqual(driverSummary.subscription, {
      status: "notSubscribed",
      endTime: null,
    });
  } finally {
    await cleanup();
  }
});

test("Driver cannot list admin user summaries", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const token = await driverToken(app);
    const result = await request(app, "/api/admin/users", {
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(result.statusCode, 403);
    assert.deepEqual(result.body, { error: "Forbidden." });
  } finally {
    await cleanup();
  }
});

test("Admin user list supports pagination query and page 2 data", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const timestamp = Date.now();
    const extraUsers = Array.from({ length: 24 }, (_, index) => ({
      name: `Paged Driver ${index}`,
      email: `admin-paged-driver-${timestamp}-${index}@example.test`,
      universityId: `PAGED${timestamp}${index}`,
      passwordHash: "$2b$12$QxQhNhjGjjWDVY4UflK22OoIxM2w6W4MFl8krTVVS0T1A6O6V0S8e",
      role: "driver",
      accountStatus: "active",
    }));
    await prisma.user.createMany({ data: extraUsers });
    const token = await adminToken(app);
    const pageOne = await request(app, "/api/admin/users?page=1&pageSize=20", {
      headers: { authorization: `Bearer ${token}` },
    });
    const pageTwo = await request(app, "/api/admin/users?page=2&pageSize=20", {
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(pageOne.statusCode, 200);
    assert.equal(pageTwo.statusCode, 200);
    assert.equal(pageOne.body.pagination.page, 1);
    assert.equal(pageTwo.body.pagination.page, 2);
    assert.equal(pageOne.body.pagination.pageSize, 20);
    assert.equal(pageTwo.body.pagination.pageSize, 20);
    assert.equal(pageOne.body.users.length, 20);
    assert.equal(pageTwo.body.users.length > 0, true);
    assert.notEqual(pageOne.body.users[0]?.id, pageTwo.body.users[0]?.id);
  } finally {
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: "admin-paged-driver-",
        },
      },
    });
    await cleanup();
  }
});

test("Admin can disable an active user and disabled user cannot log in", async () => {
  const app = await createApp();
  const { driver } = await seedUsers();

  try {
    const token = await adminToken(app);
    const result = await request(app, `/api/admin/users/${driver.id}/disable`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}` },
    });
    const disabledLogin = await login(app, driverUser.email, driverUser.password);

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.user.accountStatus, "disabled");
    assert.equal(Object.hasOwn(result.body.user, "passwordHash"), false);
    assert.equal(disabledLogin.statusCode, 403);
    assert.deepEqual(disabledLogin.body, { error: "This account is disabled." });
  } finally {
    await cleanup();
  }
});

test("Admin can reactivate a disabled user and reactivated user can log in", async () => {
  const app = await createApp();
  const { driver } = await seedUsers();

  try {
    const token = await adminToken(app);
    await request(app, `/api/admin/users/${driver.id}/disable`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}` },
    });
    const result = await request(app, `/api/admin/users/${driver.id}/reactivate`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}` },
    });
    const reactivatedLogin = await login(app, driverUser.email, driverUser.password);

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.user.accountStatus, "active");
    assert.equal(reactivatedLogin.statusCode, 200);
    assert.equal(typeof reactivatedLogin.body.token, "string");
  } finally {
    await cleanup();
  }
});

test("Disable and reactivate create account-status notifications", async () => {
  const app = await createApp();
  const { driver } = await seedUsers();

  try {
    const token = await adminToken(app);
    await request(app, `/api/admin/users/${driver.id}/disable`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}` },
    });
    await request(app, `/api/admin/users/${driver.id}/reactivate`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}` },
    });
    const notifications = await prisma.notification.findMany({
      where: {
        userId: driver.id,
        type: "accountStatus",
      },
      orderBy: { createdAt: "asc" },
    });

    assert.equal(notifications.length, 2);
    assert.equal(notifications[0].title, "Account disabled");
    assert.equal(notifications[1].title, "Account reactivated");
  } finally {
    await cleanup();
  }
});

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});
