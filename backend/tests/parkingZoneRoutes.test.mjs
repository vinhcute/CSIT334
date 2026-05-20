import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

process.env.AUTH_TOKEN_SECRET = "parking-zone-routes-test-secret";
process.env.AUTH_TOKEN_EXPIRES_IN = "1h";

const prisma = new PrismaClient();

const adminUser = {
  name: "Parking Zone Routes Admin",
  universityId: "PARKZONEADMIN001",
  email: "parking-zone-admin@example.test",
  password: "parking-zone-admin-password",
};

const driverUser = {
  name: "Parking Zone Routes Driver",
  universityId: "PARKZONEDRIVER001",
  email: "parking-zone-driver@example.test",
  password: "parking-zone-driver-password",
};

const testZoneNames = [
  "Routes North Zone",
  "Routes Library Zone",
  "Routes Duplicate Zone",
  "Routes Driver Read Zone",
  "Routes Delete Zone",
  "Routes Generated Level Zone",
  "Routes Validation Zone",
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

test("Admin can create a parking zone", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const token = await adminToken(app);
    const result = await request(app, "/api/admin/parking-zones", {
      method: "POST",
      headers: authHeaders(token),
      body: {
        zoneCode: "RZ",
        name: "Routes North Zone",
        description: "North route test zone.",
        capacity: 30,
        distanceFromEntryMeters: 150,
        displayOrder: 2,
      },
    });

    assert.equal(result.statusCode, 201);
    assert.equal(result.body.parkingZone.zoneCode, "RZ");
    assert.equal(result.body.parkingZone.name, "Routes North Zone");
    assert.equal(result.body.parkingZone.capacity, 30);
    assert.equal(result.body.parkingZone.distanceFromEntryMeters, 150);
    assert.equal(result.body.parkingZone.displayOrder, 2);
    assert.equal(
      await prisma.parkingSpot.count({ where: { zoneId: result.body.parkingZone.id } }),
      30,
    );
    assert.equal(
      await prisma.parkingSpot.count({
        where: { zoneId: result.body.parkingZone.id, level: null },
      }),
      30,
    );
  } finally {
    await cleanup();
  }
});

test("Admin can create a zone with default spot level for generated spots", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const token = await adminToken(app);
    const result = await request(app, "/api/admin/parking-zones", {
      method: "POST",
      headers: authHeaders(token),
      body: {
        zoneCode: "RG",
        name: "Routes Generated Level Zone",
        capacity: 12,
        defaultSpotLevel: "Level 2",
      },
    });

    assert.equal(result.statusCode, 201);
    const generatedSpots = await prisma.parkingSpot.findMany({
      where: { zoneId: result.body.parkingZone.id },
    });

    assert.equal(generatedSpots.length, 12);
    assert.equal(generatedSpots.every((spot) => spot.level === "Level 2"), true);
  } finally {
    await cleanup();
  }
});

test("Admin can update a parking zone", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const token = await adminToken(app);
    const created = await request(app, "/api/admin/parking-zones", {
      method: "POST",
      headers: authHeaders(token),
      body: {
        zoneCode: "RL",
        name: "Routes Library Zone",
        capacity: 20,
      },
    });
    const result = await request(
      app,
      `/api/admin/parking-zones/${created.body.parkingZone.id}`,
      {
        method: "PATCH",
        headers: authHeaders(token),
        body: {
          description: "Updated library zone.",
          zoneCode: "RLU",
          capacity: 24,
          distanceFromEntryMeters: 90,
          displayOrder: 1,
        },
      },
    );

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.parkingZone.zoneCode, "RLU");
    assert.equal(result.body.parkingZone.description, "Updated library zone.");
    assert.equal(result.body.parkingZone.capacity, 24);
    assert.equal(result.body.parkingZone.distanceFromEntryMeters, 90);
    assert.equal(result.body.parkingZone.displayOrder, 1);
  } finally {
    await cleanup();
  }
});

test("Admin can delete an empty parking zone", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const token = await adminToken(app);
    const created = await request(app, "/api/admin/parking-zones", {
      method: "POST",
      headers: authHeaders(token),
      body: {
        zoneCode: "RD",
        name: "Routes Delete Zone",
        capacity: 10,
      },
    });
    const result = await request(
      app,
      `/api/admin/parking-zones/${created.body.parkingZone.id}`,
      {
        method: "DELETE",
        headers: authHeaders(token),
      },
    );
    const deleted = await prisma.parkingZone.findUnique({
      where: { id: created.body.parkingZone.id },
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.parkingZone.name, "Routes Delete Zone");
    assert.equal(deleted, null);
  } finally {
    await cleanup();
  }
});

test("Driver and unauthenticated users cannot use admin parking zone routes", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const token = await driverToken(app);
    const driverCreate = await request(app, "/api/admin/parking-zones", {
      method: "POST",
      headers: authHeaders(token),
      body: {
        zoneCode: "RF",
        name: "Routes North Zone",
        capacity: 10,
      },
    });
    const unauthenticatedCreate = await request(app, "/api/admin/parking-zones", {
      method: "POST",
      body: {
        zoneCode: "RF",
        name: "Routes North Zone",
        capacity: 10,
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

test("Authenticated driver can read parking zones", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    await prisma.parkingZone.create({
      data: {
        zoneCode: "RR",
        name: "Routes Driver Read Zone",
        capacity: 16,
        displayOrder: 1,
      },
    });
    const token = await driverToken(app);
    const result = await request(app, "/api/parking-zones", {
      headers: authHeaders(token),
    });
    const zoneNames = result.body.parkingZones.map((zone) => zone.name);

    assert.equal(result.statusCode, 200);
    assert.equal(zoneNames.includes("Routes Driver Read Zone"), true);
  } finally {
    await cleanup();
  }
});

test("Parking zone routes return controlled validation, duplicate, and not-found responses", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const token = await adminToken(app);
    const invalid = await request(app, "/api/admin/parking-zones", {
      method: "POST",
      headers: authHeaders(token),
      body: {
        zoneCode: "",
        name: "   ",
        capacity: 0,
      },
    });
    await request(app, "/api/admin/parking-zones", {
      method: "POST",
      headers: authHeaders(token),
      body: {
        zoneCode: "RDU",
        name: "Routes Duplicate Zone",
        capacity: 8,
      },
    });
    const duplicate = await request(app, "/api/admin/parking-zones", {
      method: "POST",
      headers: authHeaders(token),
      body: {
        zoneCode: "RDX",
        name: "Routes Duplicate Zone",
        capacity: 12,
      },
    });
    const duplicateCode = await request(app, "/api/admin/parking-zones", {
      method: "POST",
      headers: authHeaders(token),
      body: {
        zoneCode: "RDU",
        name: "Routes Validation Zone",
        capacity: 12,
      },
    });
    const missing = await request(app, "/api/admin/parking-zones/missing-zone-id", {
      method: "PATCH",
      headers: authHeaders(token),
      body: { capacity: 12 },
    });

    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.body.error, "Parking zone input is invalid.");
    assert.equal(invalid.body.issues.includes("Parking zone name is required."), true);
    assert.equal(invalid.body.issues.includes("Zone ID is required."), true);
    assert.equal(invalid.body.issues.includes("Capacity must be at least 1."), true);
    assert.equal(duplicate.statusCode, 409);
    assert.deepEqual(duplicate.body, {
      error: "A parking zone with this name already exists.",
    });
    assert.equal(duplicateCode.statusCode, 409);
    assert.deepEqual(duplicateCode.body, {
      error: "A parking zone with this Zone ID already exists.",
    });
    assert.equal(missing.statusCode, 404);
    assert.deepEqual(missing.body, { error: "Parking zone not found." });
  } finally {
    await cleanup();
  }
});

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});
