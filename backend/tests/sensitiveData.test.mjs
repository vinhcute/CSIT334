import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

process.env.AUTH_TOKEN_SECRET = "sensitive-data-test-secret";
process.env.AUTH_TOKEN_EXPIRES_IN = "1h";

const prisma = new PrismaClient();

const adminUser = {
  name: "Sensitive Data Admin",
  universityId: "SENSITIVE001",
  email: "sensitive-admin@example.test",
  password: "sensitive-admin-password",
};

const driverUser = {
  name: "Sensitive Data Driver",
  universityId: "SENSITIVE002",
  email: "sensitive-driver@example.test",
  password: "sensitive-driver-password",
  licensePlate: "SENSITIVE-001",
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

async function createAdmin() {
  return prisma.user.create({
    data: {
      name: adminUser.name,
      email: adminUser.email,
      universityId: adminUser.universityId,
      passwordHash: await bcrypt.hash(adminUser.password, 12),
      role: "admin",
      accountStatus: "active",
    },
  });
}

async function registerDriver(app) {
  return request(app, "/api/auth/register", {
    method: "POST",
    body: driverUser,
  });
}

async function login(app, email, password) {
  return request(app, "/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

function hasKeyDeep(value, key) {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasKeyDeep(item, key));
  }

  return Object.entries(value).some(
    ([entryKey, entryValue]) => entryKey === key || hasKeyDeep(entryValue, key),
  );
}

function assertNoPasswordHash(responseBody) {
  assert.equal(hasKeyDeep(responseBody, "passwordHash"), false);
}

test("Serialized auth and account API responses never include passwordHash", async () => {
  const app = await createApp();
  await cleanup();

  try {
    await createAdmin();

    const registration = await registerDriver(app);
    const driverLogin = await login(app, driverUser.email, driverUser.password);
    const adminLogin = await login(app, adminUser.email, adminUser.password);
    const currentUser = await request(app, "/api/users/me", {
      headers: { authorization: `Bearer ${driverLogin.body.token}` },
    });
    const adminList = await request(app, "/api/admin/users", {
      headers: { authorization: `Bearer ${adminLogin.body.token}` },
    });

    assert.equal(registration.statusCode, 201);
    assert.equal(driverLogin.statusCode, 200);
    assert.equal(currentUser.statusCode, 200);
    assert.equal(adminList.statusCode, 200);

    assertNoPasswordHash(registration.body);
    assertNoPasswordHash(driverLogin.body);
    assertNoPasswordHash(currentUser.body);
    assertNoPasswordHash(adminList.body);
  } finally {
    await cleanup();
  }
});

test("Admin account list omits vehicle profile details and licence plates", async () => {
  const app = await createApp();
  await cleanup();

  try {
    await createAdmin();
    await registerDriver(app);
    const adminLogin = await login(app, adminUser.email, adminUser.password);
    const adminList = await request(app, "/api/admin/users", {
      headers: { authorization: `Bearer ${adminLogin.body.token}` },
    });

    assert.equal(adminList.statusCode, 200);
    assert.equal(hasKeyDeep(adminList.body, "vehicleProfiles"), false);
    assert.equal(JSON.stringify(adminList.body).includes(driverUser.licensePlate), false);
  } finally {
    await cleanup();
  }
});

test("serializeSafeUser strips passwordHash from accidental user-shaped input", async () => {
  const { serializeSafeUser } = await import("../dist/utils/safeUser.js");
  const result = serializeSafeUser({
    id: "user-id",
    email: "safe@example.test",
    passwordHash: "secret-hash",
  });

  assert.deepEqual(result, {
    id: "user-id",
    email: "safe@example.test",
  });
});

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});
