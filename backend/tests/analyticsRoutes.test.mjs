import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

process.env.AUTH_TOKEN_SECRET = "analytics-routes-test-secret";
process.env.AUTH_TOKEN_EXPIRES_IN = "1h";

const prisma = new PrismaClient();

const adminUser = {
  name: "Analytics Routes Admin",
  universityId: "ANALYTICSADMIN001",
  email: "analytics-routes-admin@example.test",
  password: "analytics-routes-admin-password",
};

const driverUser = {
  name: "Analytics Routes Driver",
  universityId: "ANALYTICSDRIVER001",
  email: "analytics-routes-driver@example.test",
  password: "analytics-routes-driver-password",
};

const testZoneName = "Analytics Routes Zone";

async function cleanup() {
  await prisma.parkingZone.deleteMany({
    where: { name: testZoneName },
  });
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
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;

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

  await prisma.user.createMany({
    data: [
      {
        name: adminUser.name,
        email: adminUser.email,
        universityId: adminUser.universityId,
        passwordHash: await bcrypt.hash(adminUser.password, 12),
        role: "admin",
        accountStatus: "active",
      },
      {
        name: driverUser.name,
        email: driverUser.email,
        universityId: driverUser.universityId,
        passwordHash: await bcrypt.hash(driverUser.password, 12),
        role: "driver",
        accountStatus: "active",
      },
    ],
  });
}

async function seedAnalyticsData() {
  const zone = await prisma.parkingZone.create({
    data: {
      name: testZoneName,
      capacity: 4,
      displayOrder: 99,
      parkingSpots: {
        create: [
          { spotCode: "AR-001", status: "occupied" },
          { spotCode: "AR-002", status: "reserved" },
          { spotCode: "AR-003", status: "available" },
          { spotCode: "AR-004", status: "available" },
        ],
      },
    },
  });

  await prisma.occupancyHistory.createMany({
    data: [
      {
        zoneId: zone.id,
        recordedAt: new Date("2026-05-17T08:00:00.000Z"),
        capacity: 4,
        availableSpots: 3,
        occupiedSpots: 1,
        reservedSpots: 0,
        occupancyRate: "25.00",
      },
      {
        zoneId: zone.id,
        recordedAt: new Date("2026-05-17T09:00:00.000Z"),
        capacity: 4,
        availableSpots: 2,
        occupiedSpots: 1,
        reservedSpots: 1,
        occupancyRate: "50.00",
      },
    ],
  });
}

async function login(app, email, password) {
  return request(app, "/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

async function tokenFor(app, user) {
  const result = await login(app, user.email, user.password);

  return result.body.token;
}

function authHeaders(token) {
  return { authorization: `Bearer ${token}` };
}

test("Admin can read campus analytics from database-backed occupancy data", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    await seedAnalyticsData();
    const token = await tokenFor(app, adminUser);
    const result = await request(app, "/api/admin/analytics?range=today", {
      headers: authHeaders(token),
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.analytics.range, "today");
    assert.ok(result.body.analytics.occupancyTrend.length >= 2);
    assert.ok(
      result.body.analytics.zoneUtilisation.some(
        (zone) =>
          zone.zoneName === testZoneName &&
          zone.occupiedSpots === 1 &&
          zone.reservedSpots === 1 &&
          zone.availableSpots === 2 &&
          zone.utilisationRate === 50,
      ),
    );
  } finally {
    await cleanup();
  }
});

test("Campus analytics enforces admin role and validates range", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const driverToken = await tokenFor(app, driverUser);
    const adminToken = await tokenFor(app, adminUser);
    const unauthenticated = await request(app, "/api/admin/analytics");
    const forbidden = await request(app, "/api/admin/analytics", {
      headers: authHeaders(driverToken),
    });
    const invalidRange = await request(app, "/api/admin/analytics?range=year", {
      headers: authHeaders(adminToken),
    });

    assert.equal(unauthenticated.statusCode, 401);
    assert.equal(forbidden.statusCode, 403);
    assert.equal(invalidRange.statusCode, 400);
  } finally {
    await cleanup();
  }
});
