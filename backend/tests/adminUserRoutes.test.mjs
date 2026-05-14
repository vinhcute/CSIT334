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
