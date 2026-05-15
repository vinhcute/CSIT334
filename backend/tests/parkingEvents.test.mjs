import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

process.env.AUTH_TOKEN_SECRET = "parking-events-test-secret";
process.env.AUTH_TOKEN_EXPIRES_IN = "1h";

const prisma = new PrismaClient();

const driverUser = {
  name: "Parking Events Driver",
  universityId: "PARKEVENTDRIVER001",
  email: "parking-events-driver@example.test",
  password: "parking-events-driver-password",
};

const adminUser = {
  name: "Parking Events Admin",
  universityId: "PARKEVENTADMIN001",
  email: "parking-events-admin@example.test",
  password: "parking-events-admin-password",
};

const testZoneNames = ["Parking Events Zone A"];

async function cleanup() {
  await prisma.parkingZone.deleteMany({
    where: { name: { in: testZoneNames } },
  });
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: driverUser.email },
        { email: adminUser.email },
        { universityId: driverUser.universityId },
        { universityId: adminUser.universityId },
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
  const body = text ? JSON.parse(text) : null;

  return { statusCode: response.status, body };
}

async function createApp() {
  const { createApp } = await import("../dist/index.js");

  return createApp();
}

async function seedUsers() {
  await cleanup();

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

async function seedSpot() {
  const zone = await prisma.parkingZone.create({
    data: {
      name: "Parking Events Zone A",
      capacity: 2,
      parkingSpots: {
        create: {
          spotCode: "PE-001",
          status: "available",
          level: "L1",
          rowLabel: "PE",
        },
      },
    },
    include: {
      parkingSpots: true,
    },
  });

  return { zone, spot: zone.parkingSpots[0] };
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

test("Authenticated clients can subscribe to parking events", async () => {
  const app = await createApp();
  await seedUsers();
  const server = await listen(app);
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const abortController = new AbortController();

  try {
    const loginResult = await login(baseUrl, driverUser.email, driverUser.password);
    const response = await fetch(`${baseUrl}/api/parking-events`, {
      headers: authHeaders(loginResult.body.token),
      signal: abortController.signal,
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type")?.includes("text/event-stream"), true);
  } finally {
    abortController.abort();
    await close(server);
    await cleanup();
  }
});

test("Detection events broadcast parking updates without sensitive user data", async () => {
  const app = await createApp();
  await seedUsers();
  const { spot } = await seedSpot();
  const server = await listen(app);
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const abortController = new AbortController();

  try {
    const driverLogin = await login(baseUrl, driverUser.email, driverUser.password);
    const adminLogin = await login(baseUrl, adminUser.email, adminUser.password);
    const streamResponse = await fetch(`${baseUrl}/api/parking-events`, {
      headers: authHeaders(driverLogin.body.token),
      signal: abortController.signal,
    });
    const updatePromise = readParkingUpdate(streamResponse);

    const detection = await request(baseUrl, "/api/admin/detection-events", {
      method: "POST",
      headers: authHeaders(adminLogin.body.token),
      body: {
        spotId: spot.id,
        type: "vehicleEntry",
      },
    });
    const update = await updatePromise;
    const serializedUpdate = JSON.stringify(update);

    assert.equal(detection.statusCode, 201);
    assert.equal(update.spotId, spot.id);
    assert.equal(update.zoneId, spot.zoneId);
    assert.equal(update.status, "occupied");
    assert.equal(update.zoneSummary.zoneId, spot.zoneId);
    assert.equal(update.zoneSummary.occupiedSpots, 1);
    assert.equal(serializedUpdate.includes("password"), false);
    assert.equal(serializedUpdate.includes("token"), false);
    assert.equal(serializedUpdate.includes(driverUser.universityId), false);
    assert.equal(serializedUpdate.includes(adminUser.universityId), false);
    assert.equal(serializedUpdate.includes("licence"), false);
    assert.equal(serializedUpdate.includes("licensePlate"), false);
  } finally {
    abortController.abort();
    await close(server);
    await cleanup();
  }
});

test("Parking events route returns 401 without authentication", async () => {
  const app = await createApp();
  const server = await listen(app);
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const response = await fetch(`${baseUrl}/api/parking-events`);
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.deepEqual(body, { error: "Authentication required." });
  } finally {
    await close(server);
  }
});

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});
