import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

process.env.AUTH_TOKEN_SECRET = "incident-report-routes-test-secret";
process.env.AUTH_TOKEN_EXPIRES_IN = "1h";

const prisma = new PrismaClient();

const adminUser = {
  name: "Incident Routes Admin",
  universityId: "INCIDENTADMIN001",
  email: "incident-routes-admin@example.test",
  password: "incident-routes-admin-password",
};

const driverUser = {
  name: "Incident Routes Driver",
  universityId: "INCIDENTDRIVER001",
  email: "incident-routes-driver@example.test",
  password: "incident-routes-driver-password",
};

const otherDriverUser = {
  name: "Incident Routes Other Driver",
  universityId: "INCIDENTDRIVER002",
  email: "incident-routes-other-driver@example.test",
  password: "incident-routes-other-driver-password",
};

const testZoneNames = ["Incident Routes Zone A", "Incident Routes Zone B"];

async function cleanup() {
  await prisma.parkingZone.deleteMany({
    where: { name: { in: testZoneNames } },
  });
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: adminUser.email },
        { email: driverUser.email },
        { email: otherDriverUser.email },
        { universityId: adminUser.universityId },
        { universityId: driverUser.universityId },
        { universityId: otherDriverUser.universityId },
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
      {
        name: otherDriverUser.name,
        email: otherDriverUser.email,
        universityId: otherDriverUser.universityId,
        passwordHash: await bcrypt.hash(otherDriverUser.password, 12),
        role: "driver",
        accountStatus: "active",
      },
    ],
  });
}

async function createSpot({ zoneName = "Incident Routes Zone A", spotCode = "IR-A-001" } = {}) {
  const zone = await prisma.parkingZone.create({
    data: {
      name: zoneName,
      capacity: 8,
    },
  });

  return prisma.parkingSpot.create({
    data: {
      zoneId: zone.id,
      spotCode,
      status: "available",
      level: "L1",
      rowLabel: "A",
    },
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

test("Driver can submit an incident report for a parking spot", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const spot = await createSpot();
    const token = await tokenFor(app, driverUser);
    const result = await request(app, "/api/incident-reports", {
      method: "POST",
      headers: authHeaders(token),
      body: {
        spotId: spot.id,
        issueType: "spotDiscrepancy",
        description: "The app says this spot is open but a car is parked here.",
      },
    });

    assert.equal(result.statusCode, 201);
    assert.equal(result.body.incidentReport.user.email, driverUser.email);
    assert.equal(result.body.incidentReport.spot.id, spot.id);
    assert.equal(result.body.incidentReport.status, "open");
    assert.equal(result.body.incidentReport.issueType, "spotDiscrepancy");
    assert.equal(hasKeyDeep(result.body, "passwordHash"), false);
    assert.equal(hasKeyDeep(result.body, "universityId"), false);
    assert.equal(hasKeyDeep(result.body, "licensePlate"), false);
  } finally {
    await cleanup();
  }
});

test("Incident submission validates required input and spot references", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const token = await tokenFor(app, driverUser);
    const missingFields = await request(app, "/api/incident-reports", {
      method: "POST",
      headers: authHeaders(token),
      body: {
        issueType: "spotDiscrepancy",
        description: "",
      },
    });
    const invalidSpot = await request(app, "/api/incident-reports", {
      method: "POST",
      headers: authHeaders(token),
      body: {
        spotId: "missing-spot-id",
        issueType: "parkingIssue",
        description: "Payment terminal is not responding.",
      },
    });

    assert.equal(missingFields.statusCode, 400);
    assert.equal(invalidSpot.statusCode, 404);
  } finally {
    await cleanup();
  }
});

test("Driver can list only their own incident reports", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const spot = await createSpot();
    const driverToken = await tokenFor(app, driverUser);
    const otherDriverToken = await tokenFor(app, otherDriverUser);
    await request(app, "/api/incident-reports", {
      method: "POST",
      headers: authHeaders(driverToken),
      body: {
        spotId: spot.id,
        issueType: "parkingIssue",
        description: "The barrier is stuck.",
      },
    });
    await request(app, "/api/incident-reports", {
      method: "POST",
      headers: authHeaders(otherDriverToken),
      body: {
        issueType: "safetyConcern",
        description: "Lighting is out near the exit.",
      },
    });

    const result = await request(app, "/api/incident-reports/me", {
      headers: authHeaders(driverToken),
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.incidentReports.length, 1);
    assert.equal(result.body.incidentReports[0].description, "The barrier is stuck.");
    assert.equal(result.body.incidentReports[0].user.email, driverUser.email);
  } finally {
    await cleanup();
  }
});

test("Admin can list, filter, review, and resolve incident reports", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const spot = await createSpot();
    const driverToken = await tokenFor(app, driverUser);
    const adminToken = await tokenFor(app, adminUser);
    const created = await request(app, "/api/incident-reports", {
      method: "POST",
      headers: authHeaders(driverToken),
      body: {
        spotId: spot.id,
        issueType: "accessibilityIssue",
        description: "Accessible bay signage is blocked.",
      },
    });

    const list = await request(app, "/api/admin/incident-reports", {
      headers: authHeaders(adminToken),
    });
    const filtered = await request(
      app,
      `/api/admin/incident-reports?status=open&issueType=accessibilityIssue&spotId=${spot.id}`,
      { headers: authHeaders(adminToken) },
    );
    const inReview = await request(
      app,
      `/api/admin/incident-reports/${created.body.incidentReport.id}/in-review`,
      {
        method: "PATCH",
        headers: authHeaders(adminToken),
      },
    );
    const resolved = await request(
      app,
      `/api/admin/incident-reports/${created.body.incidentReport.id}/resolve`,
      {
        method: "PATCH",
        headers: authHeaders(adminToken),
        body: { resolution: "Facilities notified and signage cleared." },
      },
    );

    assert.equal(list.statusCode, 200);
    assert.equal(
      list.body.incidentReports.some(
        (incidentReport) => incidentReport.id === created.body.incidentReport.id,
      ),
      true,
    );
    assert.equal(filtered.statusCode, 200);
    assert.equal(filtered.body.incidentReports.length, 1);
    assert.equal(inReview.statusCode, 200);
    assert.equal(inReview.body.incidentReport.status, "inReview");
    assert.equal(resolved.statusCode, 200);
    assert.equal(resolved.body.incidentReport.status, "resolved");
    assert.equal(
      resolved.body.incidentReport.resolution,
      "Facilities notified and signage cleared.",
    );
    assert.ok(resolved.body.incidentReport.resolvedAt);
  } finally {
    await cleanup();
  }
});

test("Admin incident actions enforce roles and resolution validation", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const driverToken = await tokenFor(app, driverUser);
    const adminToken = await tokenFor(app, adminUser);
    const created = await request(app, "/api/incident-reports", {
      method: "POST",
      headers: authHeaders(driverToken),
      body: {
        issueType: "safetyConcern",
        description: "Oil spill near the ramp.",
      },
    });

    const unauthenticated = await request(app, "/api/admin/incident-reports");
    const forbidden = await request(app, "/api/admin/incident-reports", {
      headers: authHeaders(driverToken),
    });
    const invalidResolve = await request(
      app,
      `/api/admin/incident-reports/${created.body.incidentReport.id}/resolve`,
      {
        method: "PATCH",
        headers: authHeaders(adminToken),
        body: { resolution: "" },
      },
    );
    const missingIncident = await request(
      app,
      "/api/admin/incident-reports/missing-incident-id/resolve",
      {
        method: "PATCH",
        headers: authHeaders(adminToken),
        body: { resolution: "Unable to reproduce." },
      },
    );

    assert.equal(unauthenticated.statusCode, 401);
    assert.equal(forbidden.statusCode, 403);
    assert.equal(invalidResolve.statusCode, 400);
    assert.equal(missingIncident.statusCode, 404);
  } finally {
    await cleanup();
  }
});

test("Resolved incident reports cannot be moved back to in review", async () => {
  const app = await createApp();
  await seedUsers();

  try {
    const driverToken = await tokenFor(app, driverUser);
    const adminToken = await tokenFor(app, adminUser);
    const created = await request(app, "/api/incident-reports", {
      method: "POST",
      headers: authHeaders(driverToken),
      body: {
        issueType: "parkingIssue",
        description: "Pay station receipt printer is jammed.",
      },
    });

    await request(
      app,
      `/api/admin/incident-reports/${created.body.incidentReport.id}/resolve`,
      {
        method: "PATCH",
        headers: authHeaders(adminToken),
        body: { resolution: "Printer cleared." },
      },
    );
    const result = await request(
      app,
      `/api/admin/incident-reports/${created.body.incidentReport.id}/in-review`,
      {
        method: "PATCH",
        headers: authHeaders(adminToken),
      },
    );

    assert.equal(result.statusCode, 409);
  } finally {
    await cleanup();
  }
});
