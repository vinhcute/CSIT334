import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

process.env.AUTH_TOKEN_SECRET = "parking-spot-routes-test-secret";
process.env.AUTH_TOKEN_EXPIRES_IN = "1h";

const prisma = new PrismaClient();

const adminUser = {
  name: "Parking Spot Routes Admin",
  universityId: "PARKSPOTADMIN001",
  email: "parking-spot-admin@example.test",
  password: "parking-spot-admin-password",
};

const driverUser = {
  name: "Parking Spot Routes Driver",
  universityId: "PARKSPOTDRIVER001",
  email: "parking-spot-driver@example.test",
  password: "parking-spot-driver-password",
};

const testZoneNames = [
  "Spot Routes Zone A",
  "Spot Routes Zone B",
  "Spot Routes Delete Zone",
  "Spot Routes Duplicate Zone",
];

async function cleanup() {
  await prisma.parkingZone.deleteMany({
    where: { name: { in: testZoneNames } },
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
  await prisma.user.create({
    data: {
      name: driverUser.name,
      email: driverUser.email,
      universityId: driverUser.universityId,
      passwordHash: await bcrypt.hash(driverUser.password, 12),
      role: "driver",
      accountStatus: "active",
    },
  });
}

async function createZone(name, capacity = 10) {
  return prisma.parkingZone.create({
    data: {
      zoneCode: zoneCodeForName(name),
      name,
      capacity,
    },
  });
}

function zoneCodeForName(name) {
  if (name.endsWith("Zone B")) {
    return "RSB";
  }

  if (name.includes("Delete")) {
    return "RSD";
  }

  if (name.includes("Duplicate")) {
    return "RSP";
  }

  return "RSA";
}

async function login(app, email, password) {
  return request(app, "/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

async function adminToken(app) {
  const result = await login(app, adminUser.email, adminUser.password);

  return result.body.token;
}

async function driverToken(app) {
  const result = await login(app, driverUser.email, driverUser.password);

  return result.body.token;
}

function authHeaders(token) {
  return { authorization: `Bearer ${token}` };
}

test("Admin can create a parking spot assigned to a zone", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const zone = await createZone("Spot Routes Zone A");
    const token = await adminToken(app);
    const result = await request(app, "/api/admin/parking-spots", {
      method: "POST",
      headers: authHeaders(token),
      body: {
        zoneId: zone.id,
        spotCode: "A-001",
        status: "available",
        level: "L1",
        rowLabel: "A",
      },
    });

    assert.equal(result.statusCode, 201);
    assert.equal(result.body.parkingSpot.zoneId, zone.id);
    assert.equal(result.body.parkingSpot.spotCode, "A-001");
    assert.equal(result.body.parkingSpot.status, "available");
    assert.equal(result.body.parkingSpot.level, "L1");
    assert.equal(result.body.parkingSpot.rowLabel, "A");
  } finally {
    await cleanup();
  }
});

test("Admin can update a parking spot status", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const zone = await createZone("Spot Routes Zone A");
    const spot = await prisma.parkingSpot.create({
      data: {
        zoneId: zone.id,
        spotCode: "A-002",
        status: "available",
      },
    });
    const token = await adminToken(app);
    const result = await request(app, `/api/admin/parking-spots/${spot.id}`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: {
        status: "maintenanceRequired",
      },
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.parkingSpot.status, "maintenanceRequired");
  } finally {
    await cleanup();
  }
});

test("Admin can delete a parking spot with no dependent records", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const zone = await createZone("Spot Routes Delete Zone");
    const spot = await prisma.parkingSpot.create({
      data: {
        zoneId: zone.id,
        spotCode: "DELETE-001",
        status: "available",
      },
    });
    const token = await adminToken(app);
    const result = await request(app, `/api/admin/parking-spots/${spot.id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    const deleted = await prisma.parkingSpot.findUnique({ where: { id: spot.id } });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.parkingSpot.spotCode, "DELETE-001");
    assert.equal(deleted, null);
  } finally {
    await cleanup();
  }
});

test("Driver and unauthenticated users cannot use admin parking spot routes", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const zone = await createZone("Spot Routes Zone A");
    const spot = await prisma.parkingSpot.create({
      data: {
        zoneId: zone.id,
        spotCode: "A-003",
        status: "available",
      },
    });
    const token = await driverToken(app);
    const driverCreate = await request(app, "/api/admin/parking-spots", {
      method: "POST",
      headers: authHeaders(token),
      body: {
        zoneId: zone.id,
        spotCode: "A-004",
        status: "available",
      },
    });
    const driverUpdate = await request(app, `/api/admin/parking-spots/${spot.id}`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: { status: "occupied" },
    });
    const driverDelete = await request(app, `/api/admin/parking-spots/${spot.id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    const unauthenticatedCreate = await request(app, "/api/admin/parking-spots", {
      method: "POST",
      body: {
        zoneId: zone.id,
        spotCode: "A-005",
        status: "available",
      },
    });

    assert.equal(driverCreate.statusCode, 403);
    assert.equal(driverUpdate.statusCode, 403);
    assert.equal(driverDelete.statusCode, 403);
    assert.deepEqual(driverCreate.body, { error: "Forbidden." });
    assert.equal(unauthenticatedCreate.statusCode, 401);
    assert.deepEqual(unauthenticatedCreate.body, { error: "Authentication required." });
  } finally {
    await cleanup();
  }
});

test("Authenticated driver can list parking spots and filter by status", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const zone = await createZone("Spot Routes Zone A");
    await prisma.parkingSpot.createMany({
      data: [
        { zoneId: zone.id, spotCode: "A-001", status: "available" },
        { zoneId: zone.id, spotCode: "A-002", status: "occupied" },
      ],
    });
    const token = await driverToken(app);
    const allSpots = await request(app, "/api/parking-spots", {
      headers: authHeaders(token),
    });
    const availableSpots = await request(app, "/api/parking-spots?status=available", {
      headers: authHeaders(token),
    });

    assert.equal(allSpots.statusCode, 200);
    assert.equal(allSpots.body.pagination.page, 1);
    assert.equal(allSpots.body.pagination.pageSize, 20);
    assert.equal(
      allSpots.body.parkingSpots.some((spot) => spot.spotCode === "A-001"),
      true,
    );
    assert.equal(availableSpots.statusCode, 200);
    assert.deepEqual(
      availableSpots.body.parkingSpots
        .filter((spot) => spot.zoneId === zone.id)
        .map((spot) => spot.status),
      ["available"],
    );
  } finally {
    await cleanup();
  }
});

test("Parking spot list supports pagination metadata and filters", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const zone = await createZone("Spot Routes Zone A", 30);
    await prisma.parkingSpot.createMany({
      data: Array.from({ length: 25 }, (_, index) => ({
        zoneId: zone.id,
        spotCode: `RSA-${String(index + 1).padStart(3, "0")}`,
        status: index % 2 === 0 ? "available" : "occupied",
      })),
    });
    const token = await driverToken(app);
    const result = await request(
      app,
      `/api/parking-spots?zoneId=${zone.id}&status=available&page=2&pageSize=5`,
      {
        headers: authHeaders(token),
      },
    );

    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body.pagination, {
      page: 2,
      pageSize: 5,
      total: 13,
      totalPages: 3,
    });
    assert.equal(result.body.parkingSpots.length, 5);
    assert.equal(
      result.body.parkingSpots.every((spot) => spot.zoneId === zone.id && spot.status === "available"),
      true,
    );
  } finally {
    await cleanup();
  }
});

test("Zone spot route only returns spots for that zone", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const firstZone = await createZone("Spot Routes Zone A");
    const secondZone = await createZone("Spot Routes Zone B");
    await prisma.parkingSpot.createMany({
      data: [
        { zoneId: firstZone.id, spotCode: "A-001", status: "available" },
        { zoneId: secondZone.id, spotCode: "B-001", status: "available" },
      ],
    });
    const token = await driverToken(app);
    const result = await request(app, `/api/parking-zones/${firstZone.id}/parking-spots`, {
      headers: authHeaders(token),
    });

    assert.equal(result.statusCode, 200);
    assert.deepEqual(
      result.body.parkingSpots.map((spot) => spot.spotCode),
      ["A-001"],
    );
  } finally {
    await cleanup();
  }
});

test("Parking spot routes return controlled validation, duplicate, and not-found responses", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const zone = await createZone("Spot Routes Duplicate Zone");
    const token = await adminToken(app);
    const invalidStatus = await request(app, "/api/admin/parking-spots", {
      method: "POST",
      headers: authHeaders(token),
      body: {
        zoneId: zone.id,
        spotCode: "A-001",
        status: "blocked",
      },
    });
    await request(app, "/api/admin/parking-spots", {
      method: "POST",
      headers: authHeaders(token),
      body: {
        zoneId: zone.id,
        spotCode: "DUP-001",
        status: "available",
      },
    });
    const duplicate = await request(app, "/api/admin/parking-spots", {
      method: "POST",
      headers: authHeaders(token),
      body: {
        zoneId: zone.id,
        spotCode: "DUP-001",
        status: "reserved",
      },
    });
    const missing = await request(app, "/api/admin/parking-spots/missing-spot-id", {
      method: "PATCH",
      headers: authHeaders(token),
      body: { status: "occupied" },
    });

    assert.equal(invalidStatus.statusCode, 400);
    assert.equal(invalidStatus.body.error, "Parking spot input is invalid.");
    assert.equal(invalidStatus.body.issues.includes("Parking spot status is invalid."), true);
    assert.equal(duplicate.statusCode, 409);
    assert.deepEqual(duplicate.body, {
      error: "A parking spot with this code already exists in this zone.",
    });
    assert.equal(missing.statusCode, 404);
    assert.deepEqual(missing.body, { error: "Parking spot not found." });
  } finally {
    await cleanup();
  }
});

test("Admin can preview and create the next generated spot code", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const zone = await createZone("Spot Routes Zone A");
    await prisma.parkingSpot.createMany({
      data: [
        { zoneId: zone.id, spotCode: "RSA-001", status: "available" },
        { zoneId: zone.id, spotCode: "RSA-003", status: "available" },
      ],
    });
    const token = await adminToken(app);
    const preview = await request(
      app,
      `/api/admin/parking-zones/${zone.id}/next-spot-code`,
      {
        headers: authHeaders(token),
      },
    );
    const created = await request(app, "/api/admin/parking-spots", {
      method: "POST",
      headers: authHeaders(token),
      body: {
        zoneId: zone.id,
        status: "available",
      },
    });

    assert.equal(preview.statusCode, 200);
    assert.deepEqual(preview.body, { spotCode: "RSA-004" });
    assert.equal(created.statusCode, 201);
    assert.equal(created.body.parkingSpot.spotCode, "RSA-004");
  } finally {
    await cleanup();
  }
});

test("Parking spot list rejects invalid status filters", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const token = await driverToken(app);
    const result = await request(app, "/api/parking-spots?status=blocked", {
      headers: authHeaders(token),
    });

    assert.equal(result.statusCode, 400);
    assert.equal(result.body.error, "Parking spot input is invalid.");
    assert.equal(result.body.issues.includes("Parking spot status is invalid."), true);
  } finally {
    await cleanup();
  }
});

test("Admin can bulk update spot levels for a zone", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const zone = await createZone("Spot Routes Zone A");
    await prisma.parkingSpot.createMany({
      data: [
        { zoneId: zone.id, spotCode: "A-001", status: "available" },
        { zoneId: zone.id, spotCode: "A-002", status: "reserved" },
      ],
    });
    const token = await adminToken(app);
    const result = await request(app, "/api/admin/parking-spots/bulk-level", {
      method: "PATCH",
      headers: authHeaders(token),
      body: {
        zoneId: zone.id,
        level: "Level 2",
      },
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.zoneId, zone.id);
    assert.equal(result.body.level, "Level 2");
    assert.equal(result.body.updatedCount, 2);

    const updatedSpots = await prisma.parkingSpot.findMany({ where: { zoneId: zone.id } });
    assert.equal(updatedSpots.every((spot) => spot.level === "Level 2"), true);
    assert.equal(updatedSpots.some((spot) => spot.status === "reserved"), true);
  } finally {
    await cleanup();
  }
});

test("Admin can bulk update spot levels using a spot number range", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const zone = await createZone("Spot Routes Zone A");
    await prisma.parkingSpot.createMany({
      data: [
        { zoneId: zone.id, spotCode: "RSA-001", status: "available", level: null },
        { zoneId: zone.id, spotCode: "RSA-002", status: "reserved", level: "Ground" },
        { zoneId: zone.id, spotCode: "RSA-003", status: "occupied", level: "Ground" },
        { zoneId: zone.id, spotCode: "CUSTOM-900", status: "available", level: "Outdoor" },
      ],
    });
    const token = await adminToken(app);
    const result = await request(app, "/api/admin/parking-spots/bulk-level", {
      method: "PATCH",
      headers: authHeaders(token),
      body: {
        zoneId: zone.id,
        level: "Level 2",
        range: { from: 1, to: 3 },
      },
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.zoneId, zone.id);
    assert.equal(result.body.level, "Level 2");
    assert.equal(result.body.mode, "range");
    assert.equal(result.body.updatedCount, 3);

    const updatedSpots = await prisma.parkingSpot.findMany({ where: { zoneId: zone.id } });
    const rangeSpots = updatedSpots.filter((spot) => ["RSA-001", "RSA-002", "RSA-003"].includes(spot.spotCode));
    assert.equal(rangeSpots.every((spot) => spot.level === "Level 2"), true);
    assert.equal(rangeSpots.some((spot) => spot.status === "reserved"), true);
    assert.equal(rangeSpots.some((spot) => spot.status === "occupied"), true);
    const untouchedSpot = updatedSpots.find((spot) => spot.spotCode === "CUSTOM-900");
    assert.equal(untouchedSpot.level, "Outdoor");
  } finally {
    await cleanup();
  }
});

test("Bulk spot level route enforces validation and auth", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const zone = await createZone("Spot Routes Zone A");
    const admin = await adminToken(app);
    const driver = await driverToken(app);

    const invalid = await request(app, "/api/admin/parking-spots/bulk-level", {
      method: "PATCH",
      headers: authHeaders(admin),
      body: {
        zoneId: zone.id,
        level: "   ",
      },
    });
    const forbidden = await request(app, "/api/admin/parking-spots/bulk-level", {
      method: "PATCH",
      headers: authHeaders(driver),
      body: {
        zoneId: zone.id,
        level: "Ground",
      },
    });
    const unauthenticated = await request(app, "/api/admin/parking-spots/bulk-level", {
      method: "PATCH",
      body: {
        zoneId: zone.id,
        level: "Ground",
      },
    });

    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.body.error, "Parking spot input is invalid.");
    assert.equal(invalid.body.issues.includes("Level is required."), true);
    assert.equal(forbidden.statusCode, 403);
    assert.deepEqual(forbidden.body, { error: "Forbidden." });
    assert.equal(unauthenticated.statusCode, 401);
    assert.deepEqual(unauthenticated.body, { error: "Authentication required." });
  } finally {
    await cleanup();
  }
});

test("Bulk spot level range returns conflict when expected spot codes are missing", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const zone = await createZone("Spot Routes Zone A");
    await prisma.parkingSpot.createMany({
      data: [
        { zoneId: zone.id, spotCode: "RSA-001", status: "available", level: "Ground" },
        { zoneId: zone.id, spotCode: "RSA-003", status: "available", level: "Ground" },
      ],
    });
    const token = await adminToken(app);
    const result = await request(app, "/api/admin/parking-spots/bulk-level", {
      method: "PATCH",
      headers: authHeaders(token),
      body: {
        zoneId: zone.id,
        level: "Level 2",
        range: { from: 1, to: 3 },
      },
    });

    assert.equal(result.statusCode, 409);
    assert.equal(
      result.body.error,
      "Requested range includes missing spot codes: RSA-002.",
    );

    const unchangedSpots = await prisma.parkingSpot.findMany({ where: { zoneId: zone.id } });
    assert.equal(unchangedSpots.every((spot) => spot.level === "Ground"), true);
  } finally {
    await cleanup();
  }
});

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});
