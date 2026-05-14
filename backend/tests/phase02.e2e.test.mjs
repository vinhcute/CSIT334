import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

process.env.AUTH_TOKEN_SECRET = "phase-02-e2e-test-secret";
process.env.AUTH_TOKEN_EXPIRES_IN = "1h";

const prisma = new PrismaClient();

const adminUser = {
  name: "Phase Two Admin",
  universityId: "PHASE02ADMIN001",
  email: "phase02-admin@example.test",
  password: "phase-02-admin-password",
};

const driverInput = {
  name: "Phase Two Driver",
  universityId: "PHASE02DRIVER001",
  email: "Phase02.Driver@Example.Test",
  password: "phase-02-driver-password",
  newPassword: "phase-02-driver-new-password",
  licensePlate: "P2E2E-001",
  vehicleMake: "Toyota",
  vehicleModel: "Corolla",
  vehicleColor: "White",
};

async function cleanup() {
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: adminUser.email },
        { email: driverInput.email.toLowerCase() },
        { universityId: adminUser.universityId },
        { universityId: driverInput.universityId },
      ],
    },
  });
}

async function seedAdmin() {
  await prisma.user.create({
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
    const text = await response.text();
    const body = text ? parseBody(text) : null;

    return { statusCode: response.status, body };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function parseBody(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function createApp() {
  const { createApp } = await import("../dist/index.js");

  return createApp();
}

async function login(app, email, password) {
  return request(app, "/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

function authHeaders(token) {
  return { authorization: `Bearer ${token}` };
}

function assertNoPasswordHash(value) {
  if (Array.isArray(value)) {
    value.forEach(assertNoPasswordHash);
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  assert.equal(Object.hasOwn(value, "passwordHash"), false);

  for (const child of Object.values(value)) {
    assertNoPasswordHash(child);
  }
}

test("Phase 02 end-to-end identity and account-management path works", async () => {
  const app = await createApp();
  await cleanup();
  await seedAdmin();

  try {
    const health = await request(app, "/health");
    assert.equal(health.statusCode, 200);
    assert.equal(health.body.status, "ok");

    const registration = await request(app, "/api/auth/register", {
      method: "POST",
      body: driverInput,
    });
    assert.equal(registration.statusCode, 201);
    assert.equal(registration.body.user.email, driverInput.email.toLowerCase());
    assert.equal(registration.body.user.role, "driver");
    assertNoPasswordHash(registration.body);

    const firstLogin = await login(app, driverInput.email, driverInput.password);
    assert.equal(firstLogin.statusCode, 200);
    assert.equal(typeof firstLogin.body.token, "string");
    assertNoPasswordHash(firstLogin.body);

    const driverToken = firstLogin.body.token;
    const currentProfile = await request(app, "/api/users/me", {
      headers: authHeaders(driverToken),
    });
    assert.equal(currentProfile.statusCode, 200);
    assert.equal(currentProfile.body.user.email, driverInput.email.toLowerCase());
    assertNoPasswordHash(currentProfile.body);

    const createdVehicle = await request(app, "/api/vehicle-profiles", {
      method: "POST",
      headers: authHeaders(driverToken),
      body: {
        licensePlate: "P2E2E-002",
        vehicleMake: "Honda",
        vehicleModel: "Civic",
        vehicleColor: "Blue",
      },
    });
    assert.equal(createdVehicle.statusCode, 201);
    assert.equal(createdVehicle.body.vehicleProfile.licensePlate, "P2E2E-002");

    const updatedVehicle = await request(
      app,
      `/api/vehicle-profiles/${createdVehicle.body.vehicleProfile.id}`,
      {
        method: "PATCH",
        headers: authHeaders(driverToken),
        body: {
          licensePlate: "P2E2E-003",
          vehicleMake: "Honda",
          vehicleModel: "Civic",
          vehicleColor: "Silver",
        },
      },
    );
    assert.equal(updatedVehicle.statusCode, 200);
    assert.equal(updatedVehicle.body.vehicleProfile.vehicleColor, "Silver");

    const subscription = await request(app, "/api/subscriptions", {
      method: "POST",
      headers: authHeaders(driverToken),
      body: { type: "monthly" },
    });
    assert.equal(subscription.statusCode, 201);
    assert.equal(subscription.body.subscription.type, "monthly");
    assert.match(subscription.body.message, /Simulated subscription/);

    const resetRequest = await request(app, "/api/password/reset-request", {
      method: "POST",
      body: { email: driverInput.email },
    });
    assert.equal(resetRequest.statusCode, 200);
    assert.equal(resetRequest.body.simulated, true);

    const passwordChange = await request(app, "/api/password/change", {
      method: "PATCH",
      headers: authHeaders(driverToken),
      body: {
        currentPassword: driverInput.password,
        newPassword: driverInput.newPassword,
      },
    });
    assert.equal(passwordChange.statusCode, 200);
    assert.deepEqual(passwordChange.body, { success: true });

    const oldPasswordLogin = await login(app, driverInput.email, driverInput.password);
    assert.equal(oldPasswordLogin.statusCode, 401);

    const newPasswordLogin = await login(app, driverInput.email, driverInput.newPassword);
    assert.equal(newPasswordLogin.statusCode, 200);
    const refreshedDriverToken = newPasswordLogin.body.token;

    const adminLogin = await login(app, adminUser.email, adminUser.password);
    assert.equal(adminLogin.statusCode, 200);
    const adminToken = adminLogin.body.token;

    const driverAdminAccess = await request(app, "/api/admin/users", {
      headers: authHeaders(refreshedDriverToken),
    });
    assert.equal(driverAdminAccess.statusCode, 403);

    const adminUsers = await request(app, "/api/admin/users", {
      headers: authHeaders(adminToken),
    });
    assert.equal(adminUsers.statusCode, 200);
    assertNoPasswordHash(adminUsers.body);
    const driverAccount = adminUsers.body.users.find(
      (user) => user.email === driverInput.email.toLowerCase(),
    );
    assert.ok(driverAccount);

    const disabled = await request(app, `/api/admin/users/${driverAccount.id}/disable`, {
      method: "PATCH",
      headers: authHeaders(adminToken),
    });
    assert.equal(disabled.statusCode, 200);
    assert.equal(disabled.body.user.accountStatus, "disabled");
    assertNoPasswordHash(disabled.body);

    const disabledLogin = await login(app, driverInput.email, driverInput.newPassword);
    assert.equal(disabledLogin.statusCode, 403);
    assert.deepEqual(disabledLogin.body, { error: "This account is disabled." });

    const reactivated = await request(app, `/api/admin/users/${driverAccount.id}/reactivate`, {
      method: "PATCH",
      headers: authHeaders(adminToken),
    });
    assert.equal(reactivated.statusCode, 200);
    assert.equal(reactivated.body.user.accountStatus, "active");
    assertNoPasswordHash(reactivated.body);

    const reactivatedLogin = await login(app, driverInput.email, driverInput.newPassword);
    assert.equal(reactivatedLogin.statusCode, 200);
    assert.equal(typeof reactivatedLogin.body.token, "string");
  } finally {
    await cleanup();
  }
});

test("Phase 02 does not expose Phase 3 or later feature routes early", async () => {
  const app = await createApp();
  const unavailableRoutes = [
    "/api/parking-zones",
    "/api/parking-spots",
    "/api/detection-events",
    "/api/occupancy-history",
    "/api/bookings",
    "/api/recommendations",
    "/api/predictions",
    "/api/incident-reports",
    "/api/analytics",
  ];

  for (const route of unavailableRoutes) {
    const result = await request(app, route);
    assert.equal(result.statusCode, 404, `${route} should not exist during Phase 02`);
  }
});

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});
