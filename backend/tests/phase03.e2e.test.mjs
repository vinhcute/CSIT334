import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

process.env.AUTH_TOKEN_SECRET = "phase-03-e2e-test-secret";
process.env.AUTH_TOKEN_EXPIRES_IN = "1h";

const prisma = new PrismaClient();

const adminUser = {
  name: "Phase Three Admin",
  universityId: "PHASE03ADMIN001",
  email: "phase03-admin@example.test",
  password: "phase-03-admin-password",
};

const driverUser = {
  name: "Phase Three Driver",
  universityId: "PHASE03DRIVER001",
  email: "phase03-driver@example.test",
  password: "phase-03-driver-password",
};

const testZoneNames = ["Phase 03 E2E Zone", "Phase 03 E2E Zone Updated"];

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

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1");
    server.once("listening", () => resolve(server));
    server.once("error", reject);
  });
}

async function close(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
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

async function login(baseUrl, email, password) {
  return request(baseUrl, "/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

function authHeaders(token) {
  return { authorization: `Bearer ${token}` };
}

async function readParkingUpdate(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for parking update event."));
    }, 5000);

    async function read() {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            throw new Error("Parking event stream closed before update.");
          }

          buffer += decoder.decode(value, { stream: true });

          if (!buffer.includes("\n\n")) {
            continue;
          }

          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const event of events) {
            if (!event.includes("event: parking-update")) {
              continue;
            }

            const dataLine = event
              .split("\n")
              .find((line) => line.startsWith("data: "));

            if (dataLine) {
              clearTimeout(timeout);
              resolve(JSON.parse(dataLine.slice("data: ".length)));
              return;
            }
          }
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    }

    read();
  });
}

function findZoneSummary(summary, zoneId) {
  const zone = summary.zones.find((candidate) => candidate.zoneId === zoneId);
  assert.ok(zone, `Expected occupancy summary to include zone ${zoneId}`);
  return zone;
}

test("Phase 03 end-to-end parking inventory and monitoring path works", async () => {
  const app = await createApp();
  await seedUsers();
  const server = await listen(app);
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const abortController = new AbortController();

  try {
    const health = await request(baseUrl, "/health");
    assert.equal(health.statusCode, 200);
    assert.equal(health.body.status, "ok");

    const adminLogin = await login(baseUrl, adminUser.email, adminUser.password);
    assert.equal(adminLogin.statusCode, 200);
    const adminToken = adminLogin.body.token;

    const driverLogin = await login(baseUrl, driverUser.email, driverUser.password);
    assert.equal(driverLogin.statusCode, 200);
    const driverToken = driverLogin.body.token;

    const driverZoneMutation = await request(baseUrl, "/api/admin/parking-zones", {
      method: "POST",
      headers: authHeaders(driverToken),
      body: {
        name: "Phase 03 Forbidden Zone",
        capacity: 1,
      },
    });
    assert.equal(driverZoneMutation.statusCode, 403);

    const createdZone = await request(baseUrl, "/api/admin/parking-zones", {
      method: "POST",
      headers: authHeaders(adminToken),
      body: {
        name: "Phase 03 E2E Zone",
        description: "End-to-end verification zone",
        capacity: 3,
        distanceFromEntryMeters: 120,
        displayOrder: 300,
      },
    });
    assert.equal(createdZone.statusCode, 201);
    assert.equal(createdZone.body.parkingZone.name, "Phase 03 E2E Zone");
    const zoneId = createdZone.body.parkingZone.id;

    const driverZones = await request(baseUrl, "/api/parking-zones", {
      headers: authHeaders(driverToken),
    });
    assert.equal(driverZones.statusCode, 200);
    assert.ok(driverZones.body.parkingZones.some((zone) => zone.id === zoneId));

    const updatedZone = await request(baseUrl, `/api/admin/parking-zones/${zoneId}`, {
      method: "PATCH",
      headers: authHeaders(adminToken),
      body: {
        name: "Phase 03 E2E Zone Updated",
        description: "Updated by Phase 03 e2e",
        distanceFromEntryMeters: 90,
      },
    });
    assert.equal(updatedZone.statusCode, 200);
    assert.equal(updatedZone.body.parkingZone.name, "Phase 03 E2E Zone Updated");
    assert.equal(updatedZone.body.parkingZone.distanceFromEntryMeters, 90);

    const driverSpotMutation = await request(baseUrl, "/api/admin/parking-spots", {
      method: "POST",
      headers: authHeaders(driverToken),
      body: {
        zoneId,
        spotCode: "P3-FORBIDDEN",
        status: "available",
      },
    });
    assert.equal(driverSpotMutation.statusCode, 403);

    const createdSpot = await request(baseUrl, "/api/admin/parking-spots", {
      method: "POST",
      headers: authHeaders(adminToken),
      body: {
        zoneId,
        spotCode: "P3-001",
        status: "available",
        level: "Ground",
        rowLabel: "P3",
      },
    });
    assert.equal(createdSpot.statusCode, 201);
    assert.equal(createdSpot.body.parkingSpot.status, "available");
    const availableSpotId = createdSpot.body.parkingSpot.id;

    const reservedSpot = await request(baseUrl, "/api/admin/parking-spots", {
      method: "POST",
      headers: authHeaders(adminToken),
      body: {
        zoneId,
        spotCode: "P3-002",
        status: "reserved",
        level: "Ground",
        rowLabel: "P3",
      },
    });
    assert.equal(reservedSpot.statusCode, 201);
    const reservedSpotId = reservedSpot.body.parkingSpot.id;

    const deleteCandidate = await request(baseUrl, "/api/admin/parking-spots", {
      method: "POST",
      headers: authHeaders(adminToken),
      body: {
        zoneId,
        spotCode: "P3-DELETE",
        status: "available",
        level: "Ground",
        rowLabel: "P3",
      },
    });
    assert.equal(deleteCandidate.statusCode, 201);

    const invalidSpotStatus = await request(baseUrl, "/api/admin/parking-spots", {
      method: "POST",
      headers: authHeaders(adminToken),
      body: {
        zoneId,
        spotCode: "P3-BLOCKED",
        status: "blocked",
      },
    });
    assert.equal(invalidSpotStatus.statusCode, 400);

    const updatedSpot = await request(
      baseUrl,
      `/api/admin/parking-spots/${reservedSpotId}`,
      {
        method: "PATCH",
        headers: authHeaders(adminToken),
        body: {
          status: "maintenanceRequired",
          rowLabel: "P3M",
        },
      },
    );
    assert.equal(updatedSpot.statusCode, 200);
    assert.equal(updatedSpot.body.parkingSpot.status, "maintenanceRequired");
    assert.equal(updatedSpot.body.parkingSpot.rowLabel, "P3M");

    const deletedSpot = await request(
      baseUrl,
      `/api/admin/parking-spots/${deleteCandidate.body.parkingSpot.id}`,
      {
        method: "DELETE",
        headers: authHeaders(adminToken),
      },
    );
    assert.equal(deletedSpot.statusCode, 200);
    assert.equal(deletedSpot.body.parkingSpot.spotCode, "P3-DELETE");

    const driverSpots = await request(baseUrl, "/api/parking-spots", {
      headers: authHeaders(driverToken),
    });
    assert.equal(driverSpots.statusCode, 200);
    assert.ok(driverSpots.body.parkingSpots.some((spot) => spot.id === availableSpotId));

    const zoneSpots = await request(baseUrl, `/api/parking-zones/${zoneId}/parking-spots`, {
      headers: authHeaders(driverToken),
    });
    assert.equal(zoneSpots.statusCode, 200);
    assert.equal(zoneSpots.body.parkingSpots.length, 2);
    assert.ok(zoneSpots.body.parkingSpots.every((spot) => spot.zoneId === zoneId));

    const initialSummary = await request(baseUrl, "/api/occupancy/summary", {
      headers: authHeaders(driverToken),
    });
    assert.equal(initialSummary.statusCode, 200);
    const initialZoneSummary = findZoneSummary(initialSummary.body.summary, zoneId);
    assert.equal(initialZoneSummary.capacity, 3);
    assert.equal(initialZoneSummary.availableSpots, 1);
    assert.equal(initialZoneSummary.occupiedSpots, 0);
    assert.equal(initialZoneSummary.reservedSpots, 0);
    assert.equal(initialZoneSummary.maintenanceRequiredSpots, 1);

    const initialZoneDetail = await request(baseUrl, `/api/occupancy/zones/${zoneId}`, {
      headers: authHeaders(driverToken),
    });
    assert.equal(initialZoneDetail.statusCode, 200);
    assert.equal(initialZoneDetail.body.zone.spots.length, 2);

    const streamResponse = await fetch(`${baseUrl}/api/parking-events`, {
      headers: authHeaders(driverToken),
      signal: abortController.signal,
    });
    assert.equal(streamResponse.status, 200);
    assert.equal(streamResponse.headers.get("content-type")?.includes("text/event-stream"), true);
    const updatePromise = readParkingUpdate(streamResponse);

    const entryStartedAt = Date.now();
    const entryEvent = await request(baseUrl, "/api/admin/detection-events", {
      method: "POST",
      headers: authHeaders(adminToken),
      body: {
        spotId: availableSpotId,
        type: "vehicleEntry",
        rawPayload: {
          simulated: true,
          source: "phase-03-e2e",
        },
      },
    });
    const parkingUpdate = await updatePromise;
    const realtimeMs = Date.now() - entryStartedAt;

    assert.equal(entryEvent.statusCode, 201);
    assert.equal(entryEvent.body.detectionEvent.type, "vehicleEntry");
    assert.equal(entryEvent.body.parkingSpot.status, "occupied");
    assert.equal(parkingUpdate.spotId, availableSpotId);
    assert.equal(parkingUpdate.status, "occupied");
    assert.equal(parkingUpdate.zoneSummary.occupiedSpots, 1);
    assert.ok(realtimeMs < 3000, `Expected parking update within 3 seconds, got ${realtimeMs}ms`);

    const exitEvent = await request(baseUrl, "/api/admin/detection-events", {
      method: "POST",
      headers: authHeaders(adminToken),
      body: {
        spotId: availableSpotId,
        type: "vehicleExit",
        rawPayload: {
          simulated: true,
          source: "phase-03-e2e",
        },
      },
    });
    assert.equal(exitEvent.statusCode, 201);
    assert.equal(exitEvent.body.detectionEvent.type, "vehicleExit");
    assert.equal(exitEvent.body.parkingSpot.status, "available");

    const storedEvents = await request(baseUrl, "/api/admin/detection-events", {
      headers: authHeaders(adminToken),
    });
    assert.equal(storedEvents.statusCode, 200);
    const storedEventIds = storedEvents.body.detectionEvents.map((event) => event.id);
    assert.ok(storedEventIds.includes(entryEvent.body.detectionEvent.id));
    assert.ok(storedEventIds.includes(exitEvent.body.detectionEvent.id));

    const finalSummary = await request(baseUrl, "/api/occupancy/summary", {
      headers: authHeaders(driverToken),
    });
    assert.equal(finalSummary.statusCode, 200);
    const finalZoneSummary = findZoneSummary(finalSummary.body.summary, zoneId);
    assert.equal(finalZoneSummary.capacity, 3);
    assert.equal(finalZoneSummary.availableSpots, 1);
    assert.equal(finalZoneSummary.occupiedSpots, 0);
    assert.equal(finalZoneSummary.reservedSpots, 0);
    assert.equal(finalZoneSummary.maintenanceRequiredSpots, 1);

    const deletedZone = await request(baseUrl, `/api/admin/parking-zones/${zoneId}`, {
      method: "DELETE",
      headers: authHeaders(adminToken),
    });
    assert.equal(deletedZone.statusCode, 200);
    assert.equal(deletedZone.body.parkingZone.id, zoneId);
  } finally {
    abortController.abort();
    await close(server);
    await cleanup();
  }
});

test("Phase 03 does not expose Phase 4 or Phase 5 workflows early", async () => {
  const app = await createApp();
  await seedUsers();
  const server = await listen(app);
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const driverLogin = await login(baseUrl, driverUser.email, driverUser.password);
    assert.equal(driverLogin.statusCode, 200);

    const unavailableRoutes = [
      { method: "POST", path: "/api/bookings" },
      { method: "GET", path: "/api/bookings" },
      { method: "GET", path: "/api/recommendations" },
      { method: "GET", path: "/api/predictions" },
      { method: "GET", path: "/api/incident-reports" },
      { method: "GET", path: "/api/analytics" },
    ];

    for (const route of unavailableRoutes) {
      const result = await request(baseUrl, route.path, {
        method: route.method,
        headers: authHeaders(driverLogin.body.token),
      });
      assert.equal(
        result.statusCode,
        404,
        `${route.method} ${route.path} should not exist during Phase 03`,
      );
    }
  } finally {
    await close(server);
    await cleanup();
  }
});

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});
