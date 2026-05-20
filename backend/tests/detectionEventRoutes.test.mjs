import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

process.env.AUTH_TOKEN_SECRET = "detection-event-routes-test-secret";
process.env.AUTH_TOKEN_EXPIRES_IN = "1h";

const prisma = new PrismaClient();

const adminUser = {
  name: "Detection Routes Admin",
  universityId: "DETECTADMIN001",
  email: "detection-routes-admin@example.test",
  password: "detection-routes-admin-password",
};

const driverUser = {
  name: "Detection Routes Driver",
  universityId: "DETECTDRIVER001",
  email: "detection-routes-driver@example.test",
  password: "detection-routes-driver-password",
};

const testZoneNames = [
  "Detection Routes Zone A",
  "Detection Routes Zone B",
  "Detection Routes List Zone",
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

async function createSpot({ zoneName = "Detection Routes Zone A", status = "available" } = {}) {
  const zone = await prisma.parkingZone.create({
    data: {
      zoneCode: zoneName.endsWith("B") ? "DRB" : "DRA",
      name: zoneName,
      capacity: 4,
    },
  });

  return prisma.parkingSpot.create({
    data: {
      zoneId: zone.id,
      spotCode: `${zoneName.slice(-6).trim() || "SPOT"}-001`,
      status,
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

test("Admin can post a vehicleEntry detection event and receive the occupied spot", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const spot = await createSpot();
    const token = await adminToken(app);
    const result = await request(app, "/api/admin/detection-events", {
      method: "POST",
      headers: authHeaders(token),
      body: {
        spotId: spot.id,
        type: "vehicleEntry",
        occurredAt: "2026-05-15T01:30:00.000Z",
        rawPayload: {
          source: "route-test-simulator",
          confidence: 0.91,
        },
      },
    });

    assert.equal(result.statusCode, 201);
    assert.equal(result.body.detectionEvent.spotId, spot.id);
    assert.equal(result.body.detectionEvent.type, "vehicleEntry");
    assert.deepEqual(result.body.detectionEvent.rawPayload, {
      source: "route-test-simulator",
      confidence: 0.91,
    });
    assert.equal(result.body.parkingSpot.status, "occupied");
  } finally {
    await cleanup();
  }
});

test("Admin can post a vehicleExit detection event and receive the available spot", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const spot = await createSpot({ status: "occupied" });
    const token = await adminToken(app);
    const result = await request(app, "/api/admin/detection-events", {
      method: "POST",
      headers: authHeaders(token),
      body: {
        spotId: spot.id,
        type: "vehicleExit",
      },
    });

    assert.equal(result.statusCode, 201);
    assert.equal(result.body.detectionEvent.type, "vehicleExit");
    assert.equal(result.body.parkingSpot.status, "available");
  } finally {
    await cleanup();
  }
});

test("Driver and unauthenticated users cannot post detection events", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const spot = await createSpot();
    const token = await driverToken(app);
    const driverCreate = await request(app, "/api/admin/detection-events", {
      method: "POST",
      headers: authHeaders(token),
      body: {
        spotId: spot.id,
        type: "vehicleEntry",
      },
    });
    const unauthenticatedCreate = await request(app, "/api/admin/detection-events", {
      method: "POST",
      body: {
        spotId: spot.id,
        type: "vehicleEntry",
      },
    });

    assert.equal(driverCreate.statusCode, 403);
    assert.deepEqual(driverCreate.body, { error: "Forbidden." });
    assert.equal(unauthenticatedCreate.statusCode, 401);
    assert.deepEqual(unauthenticatedCreate.body, { error: "Authentication required." });
  } finally {
    await cleanup();
  }
});

test("Detection event route returns validation and not-found responses", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const token = await adminToken(app);
    const invalidType = await request(app, "/api/admin/detection-events", {
      method: "POST",
      headers: authHeaders(token),
      body: {
        spotId: "spot-id",
        type: "pedestrianDetected",
      },
    });
    const missingSpot = await request(app, "/api/admin/detection-events", {
      method: "POST",
      headers: authHeaders(token),
      body: {
        spotId: "missing-spot-id",
        type: "vehicleEntry",
      },
    });

    assert.equal(invalidType.statusCode, 400);
    assert.equal(invalidType.body.error, "Detection event input is invalid.");
    assert.equal(invalidType.body.issues.includes("Detection event type is invalid."), true);
    assert.equal(missingSpot.statusCode, 404);
    assert.deepEqual(missingSpot.body, { error: "Parking spot not found." });
  } finally {
    await cleanup();
  }
});

test("Detection event route rejects reserved spot overrides", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const spot = await createSpot({
      zoneName: "Detection Routes Zone B",
      status: "reserved",
    });
    const token = await adminToken(app);
    const result = await request(app, "/api/admin/detection-events", {
      method: "POST",
      headers: authHeaders(token),
      body: {
        spotId: spot.id,
        type: "vehicleExit",
      },
    });

    assert.equal(result.statusCode, 409);
    assert.deepEqual(result.body, {
      error: "Reserved parking spots cannot be changed by detection events.",
    });
  } finally {
    await cleanup();
  }
});

test("Admin can list recent detection events", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const spot = await createSpot({ zoneName: "Detection Routes List Zone" });
    await prisma.detectionEvent.create({
      data: {
        spotId: spot.id,
        type: "vehicleEntry",
        occurredAt: new Date("2026-05-15T01:00:00.000Z"),
        rawPayload: { source: "older-event" },
      },
    });
    await prisma.detectionEvent.create({
      data: {
        spotId: spot.id,
        type: "vehicleExit",
        occurredAt: new Date("2026-05-15T02:00:00.000Z"),
        rawPayload: { source: "newer-event" },
      },
    });
    const token = await adminToken(app);
    const result = await request(app, "/api/admin/detection-events", {
      headers: authHeaders(token),
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.detectionEvents.length >= 2, true);
    assert.equal(result.body.pagination.page, 1);
    assert.equal(result.body.pagination.pageSize, 20);
    assert.equal(typeof result.body.pagination.total, "number");
    assert.equal(typeof result.body.pagination.totalPages, "number");
    assert.deepEqual(
      result.body.detectionEvents
        .filter((event) => event.spotId === spot.id)
        .map((event) => event.type),
      ["vehicleExit", "vehicleEntry"],
    );
    const latest = result.body.detectionEvents.find((event) => event.spotId === spot.id);
    assert.equal(latest.spot.spotCode, spot.spotCode);
    assert.equal(latest.spot.zoneId, spot.zoneId);
  } finally {
    await cleanup();
  }
});

test("Detection event route supports pagination and spot filter", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const spotA = await createSpot({ zoneName: "Detection Routes Zone A" });
    const spotB = await createSpot({ zoneName: "Detection Routes Zone B" });
    await prisma.detectionEvent.createMany({
      data: [
        { spotId: spotA.id, type: "vehicleEntry", occurredAt: new Date("2026-05-15T03:00:00.000Z") },
        { spotId: spotA.id, type: "vehicleExit", occurredAt: new Date("2026-05-15T02:00:00.000Z") },
        { spotId: spotB.id, type: "vehicleEntry", occurredAt: new Date("2026-05-15T01:00:00.000Z") },
      ],
    });
    const token = await adminToken(app);
    const filtered = await request(
      app,
      `/api/admin/detection-events?page=1&pageSize=1&spotId=${spotA.id}`,
      {
        headers: authHeaders(token),
      },
    );

    assert.equal(filtered.statusCode, 200);
    assert.equal(filtered.body.detectionEvents.length, 1);
    assert.equal(filtered.body.detectionEvents[0].spotId, spotA.id);
    assert.equal(filtered.body.pagination.page, 1);
    assert.equal(filtered.body.pagination.pageSize, 1);
    assert.equal(filtered.body.pagination.total >= 2, true);
    assert.equal(filtered.body.pagination.totalPages >= 2, true);
  } finally {
    await cleanup();
  }
});

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});
