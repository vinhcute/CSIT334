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
      name,
      capacity,
    },
  });
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

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});
