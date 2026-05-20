import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

process.env.AUTH_TOKEN_SECRET = "occupancy-routes-test-secret";
process.env.AUTH_TOKEN_EXPIRES_IN = "1h";

const prisma = new PrismaClient();

const adminUser = {
  name: "Occupancy Routes Admin",
  universityId: "OCCADMIN001",
  email: "occupancy-routes-admin@example.test",
  password: "occupancy-routes-admin-password",
};

const driverUser = {
  name: "Occupancy Routes Driver",
  universityId: "OCCDRIVER001",
  email: "occupancy-routes-driver@example.test",
  password: "occupancy-routes-driver-password",
};

const testZoneNames = [
  "Occupancy Routes Zone A",
  "Occupancy Routes Zone B",
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

async function seedZones() {
  const firstZone = await prisma.parkingZone.create({
    data: {
      zoneCode: "ORA",
      name: "Occupancy Routes Zone A",
      capacity: 4,
      displayOrder: 1,
      parkingSpots: {
        create: [
          { spotCode: "A-001", status: "available", level: "L1", rowLabel: "A" },
          { spotCode: "A-002", status: "occupied", level: "L1", rowLabel: "A" },
          { spotCode: "A-003", status: "reserved", level: "L1", rowLabel: "A" },
          {
            spotCode: "A-004",
            status: "maintenanceRequired",
            level: "L1",
            rowLabel: "A",
          },
        ],
      },
    },
  });
  await prisma.parkingZone.create({
    data: {
      zoneCode: "ORB",
      name: "Occupancy Routes Zone B",
      capacity: 2,
      displayOrder: 2,
      parkingSpots: {
        create: [
          { spotCode: "B-001", status: "available", level: "L2", rowLabel: "B" },
        ],
      },
    },
  });

  return firstZone;
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

test("Authenticated driver can read occupancy summary totals", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    await seedZones();
    const token = await driverToken(app);
    const result = await request(app, "/api/occupancy/summary", {
      headers: authHeaders(token),
    });
    const routeZones = result.body.summary.zones.filter((zone) =>
      testZoneNames.includes(zone.name),
    );

    assert.equal(result.statusCode, 200);
    assert.equal(routeZones.length, 2);
    assert.equal(
      routeZones.reduce((sum, zone) => sum + zone.capacity, 0),
      6,
    );
    assert.equal(
      routeZones.reduce((sum, zone) => sum + zone.availableSpots, 0),
      2,
    );
    assert.equal(result.body.summary.totalCapacity >= 6, true);
    assert.equal(result.body.summary.totalAvailableSpots >= 2, true);
  } finally {
    await cleanup();
  }
});

test("Authenticated admin can read occupancy summary", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    await seedZones();
    const token = await adminToken(app);
    const result = await request(app, "/api/occupancy/summary", {
      headers: authHeaders(token),
    });

    assert.equal(result.statusCode, 200);
    assert.equal(Array.isArray(result.body.summary.zones), true);
  } finally {
    await cleanup();
  }
});

test("Occupancy routes reject unauthenticated callers", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const result = await request(app, "/api/occupancy/summary");

    assert.equal(result.statusCode, 401);
    assert.deepEqual(result.body, { error: "Authentication required." });
  } finally {
    await cleanup();
  }
});

test("Zone occupancy detail includes spot status values and text labels", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const zone = await seedZones();
    const token = await driverToken(app);
    const result = await request(app, `/api/occupancy/zones/${zone.id}`, {
      headers: authHeaders(token),
    });
    const spot = result.body.zone.spots.find(
      (candidate) => candidate.spotCode === "A-004",
    );

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.zone.zoneId, zone.id);
    assert.equal(result.body.zone.availableSpots, 1);
    assert.equal(result.body.zone.occupiedSpots, 1);
    assert.equal(result.body.zone.reservedSpots, 1);
    assert.equal(result.body.zone.occupancyRate, "50.00");
    assert.equal(spot.status, "maintenanceRequired");
    assert.equal(spot.statusText, "Maintenance required");
    assert.equal(spot.level, "L1");
    assert.equal(spot.rowLabel, "A");
  } finally {
    await cleanup();
  }
});

test("Zone occupancy detail returns a controlled not-found response", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const token = await driverToken(app);
    const result = await request(app, "/api/occupancy/zones/missing-zone-id", {
      headers: authHeaders(token),
    });

    assert.equal(result.statusCode, 404);
    assert.deepEqual(result.body, { error: "Parking zone not found." });
  } finally {
    await cleanup();
  }
});

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});
