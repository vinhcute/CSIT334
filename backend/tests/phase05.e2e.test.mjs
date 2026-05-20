import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

process.env.AUTH_TOKEN_SECRET = "phase-05-e2e-test-secret";
process.env.AUTH_TOKEN_EXPIRES_IN = "1h";

const prisma = new PrismaClient();
const phaseTag = `P5E2E-${Date.now()}`;

const adminUser = {
  name: "Phase Five Admin",
  universityId: `${phaseTag}-ADMIN`,
  email: `${phaseTag.toLowerCase()}-admin@example.test`,
  password: "phase-05-admin-password",
};

const driverUser = {
  name: "Phase Five Driver",
  universityId: `${phaseTag}-DRIVER`,
  email: `${phaseTag.toLowerCase()}-driver@example.test`,
  password: "phase-05-driver-password",
  licensePlate: `${phaseTag}-CAR`,
};

async function cleanup() {
  await prisma.notification.deleteMany({
    where: {
      OR: [
        { user: { email: { in: [adminUser.email, driverUser.email] } } },
        { booking: { spot: { zone: { name: { startsWith: phaseTag } } } } },
      ],
    },
  });
  await prisma.incidentReport.deleteMany({
    where: {
      OR: [
        { user: { email: { in: [adminUser.email, driverUser.email] } } },
        { spot: { zone: { name: { startsWith: phaseTag } } } },
      ],
    },
  });
  await prisma.booking.deleteMany({
    where: { spot: { zone: { name: { startsWith: phaseTag } } } },
  });
  await prisma.occupancyHistory.deleteMany({
    where: { zone: { name: { startsWith: phaseTag } } },
  });
  await prisma.detectionEvent.deleteMany({
    where: { spot: { zone: { name: { startsWith: phaseTag } } } },
  });
  await prisma.parkingSpot.deleteMany({
    where: { zone: { name: { startsWith: phaseTag } } },
  });
  await prisma.parkingZone.deleteMany({
    where: { name: { startsWith: phaseTag } },
  });
  await prisma.subscription.deleteMany({
    where: { user: { email: { in: [adminUser.email, driverUser.email] } } },
  });
  await prisma.vehicleProfile.deleteMany({
    where: { user: { email: { in: [adminUser.email, driverUser.email] } } },
  });
  await prisma.user.deleteMany({
    where: { email: { in: [adminUser.email, driverUser.email] } },
  });
}

async function seedBaseData() {
  await cleanup();

  const [admin, driver] = await Promise.all([
    prisma.user.create({
      data: {
        name: adminUser.name,
        email: adminUser.email,
        universityId: adminUser.universityId,
        passwordHash: await bcrypt.hash(adminUser.password, 12),
        role: "admin",
        accountStatus: "active",
      },
    }),
    prisma.user.create({
      data: {
        name: driverUser.name,
        email: driverUser.email,
        universityId: driverUser.universityId,
        passwordHash: await bcrypt.hash(driverUser.password, 12),
        role: "driver",
        accountStatus: "active",
      },
    }),
  ]);

  await prisma.vehicleProfile.create({
    data: {
      userId: driver.id,
      licensePlate: driverUser.licensePlate,
      isPrimary: true,
    },
  });

  const now = new Date();
  await prisma.subscription.create({
    data: {
      userId: driver.id,
      type: "monthly",
      status: "active",
      startTime: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const [northZone, southZone] = await Promise.all([
    prisma.parkingZone.create({
      data: {
        zoneCode: `${phaseTag.slice(0, 8)}N`,
        name: `${phaseTag} North Zone`,
        description: "Phase 05 recommendation/prediction zone",
        capacity: 8,
        distanceFromEntryMeters: 80,
        displayOrder: 1,
      },
    }),
    prisma.parkingZone.create({
      data: {
        zoneCode: `${phaseTag.slice(0, 8)}S`,
        name: `${phaseTag} South Zone`,
        description: "Phase 05 recommendation comparison zone",
        capacity: 8,
        distanceFromEntryMeters: 220,
        displayOrder: 2,
      },
    }),
  ]);

  const [northAvailableSpot, northOccupiedSpot, northReservedSpot, southAvailableSpot] =
    await Promise.all([
      prisma.parkingSpot.create({
        data: {
          zoneId: northZone.id,
          spotCode: "P5-N-001",
          status: "available",
        },
      }),
      prisma.parkingSpot.create({
        data: {
          zoneId: northZone.id,
          spotCode: "P5-N-002",
          status: "occupied",
        },
      }),
      prisma.parkingSpot.create({
        data: {
          zoneId: northZone.id,
          spotCode: "P5-N-003",
          status: "reserved",
        },
      }),
      prisma.parkingSpot.create({
        data: {
          zoneId: southZone.id,
          spotCode: "P5-S-001",
          status: "available",
        },
      }),
    ]);

  const target = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  target.setUTCMinutes(0, 0, 0);
  const sampleTimes = [7, 14, 21, 28].map((daysAgo) => {
    const recordedAt = new Date(target);
    recordedAt.setUTCDate(recordedAt.getUTCDate() - daysAgo);
    return recordedAt;
  });

  await prisma.occupancyHistory.createMany({
    data: sampleTimes.map((recordedAt, index) => ({
      zoneId: northZone.id,
      recordedAt,
      capacity: northZone.capacity,
      availableSpots: 3 + (index % 2),
      occupiedSpots: 3,
      reservedSpots: 1,
      occupancyRate: "50.00",
    })),
  });

  return {
    admin,
    driver,
    northZone,
    southZone,
    northAvailableSpot,
    northOccupiedSpot,
    northReservedSpot,
    southAvailableSpot,
    predictionTargetTime: target.toISOString(),
  };
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

function assertNoSensitiveData(value) {
  const serialized = JSON.stringify(value);

  assert.equal(serialized.includes("passwordHash"), false);
  assert.equal(serialized.includes("universityId"), false);
  assert.equal(serialized.includes("licensePlate"), false);
  assert.equal(serialized.includes("licencePlate"), false);
}

function authHeaders(token) {
  return { authorization: `Bearer ${token}` };
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

test("Phase 05 end-to-end smart features, incidents, and analytics path works", async () => {
  const app = await createApp();
  const seeded = await seedBaseData();
  const server = await listen(app);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const health = await request(baseUrl, "/health");
    assert.equal(health.statusCode, 200);
    assert.equal(health.body.status, "ok");

    const adminLogin = await login(baseUrl, adminUser.email, adminUser.password);
    const driverLogin = await login(baseUrl, driverUser.email, driverUser.password);
    assert.equal(adminLogin.statusCode, 200);
    assert.equal(driverLogin.statusCode, 200);
    const adminToken = adminLogin.body.token;
    const driverToken = driverLogin.body.token;

    const unauthenticatedRecommendation = await request(baseUrl, "/api/recommendations/zones");
    assert.equal(unauthenticatedRecommendation.statusCode, 401);

    const recommendationZones = await request(baseUrl, "/api/recommendations/zones", {
      headers: authHeaders(driverToken),
    });
    assert.equal(recommendationZones.statusCode, 200);
    assert.equal(Array.isArray(recommendationZones.body.recommendations.recommendations), true);
    assert.equal(recommendationZones.body.recommendations.recommendations.length > 0, true);
    assert.equal(recommendationZones.body.recommendations.nearestAvailableZone !== null, true);
    assert.equal(recommendationZones.body.recommendations.leastCongestedZone !== null, true);
    assertNoSensitiveData(recommendationZones.body);

    const prediction = await request(
      baseUrl,
      `/api/predictive-availability?zoneId=${seeded.northZone.id}&targetTime=${encodeURIComponent(
        seeded.predictionTargetTime,
      )}`,
      {
        headers: authHeaders(driverToken),
      },
    );
    assert.equal(prediction.statusCode, 200);
    assert.equal(prediction.body.prediction.zoneId, seeded.northZone.id);
    assert.equal(typeof prediction.body.prediction.predictedAvailableSpots, "number");
    assert.equal(prediction.body.prediction.historicalSampleCount >= 3, true);
    assertNoSensitiveData(prediction.body);

    const driverAnalyticsAttempt = await request(baseUrl, "/api/admin/analytics/summary", {
      headers: authHeaders(driverToken),
    });
    assert.equal(driverAnalyticsAttempt.statusCode, 403);

    const adminAnalytics = await request(baseUrl, "/api/admin/analytics/summary?range=week", {
      headers: authHeaders(adminToken),
    });
    assert.equal(adminAnalytics.statusCode, 200);
    assert.equal(adminAnalytics.body.summary.range, "week");
    assert.equal(Array.isArray(adminAnalytics.body.summary.occupancyTrends), true);
    assert.equal(Array.isArray(adminAnalytics.body.summary.peakHours), true);
    assert.equal(Array.isArray(adminAnalytics.body.summary.zoneUtilisation), true);
    assertNoSensitiveData(adminAnalytics.body);

    const createdIncident = await request(baseUrl, "/api/incident-reports", {
      method: "POST",
      headers: authHeaders(driverToken),
      body: {
        issueType: "spotDiscrepancy",
        description: "Spot status did not match actual occupancy during repeated checks.",
        spotId: seeded.northOccupiedSpot.id,
      },
    });
    assert.equal(createdIncident.statusCode, 201);
    assert.equal(createdIncident.body.incidentReport.issueType, "spotDiscrepancy");
    const incidentId = createdIncident.body.incidentReport.id;
    assertNoSensitiveData(createdIncident.body);

    const updatedSpot = await prisma.parkingSpot.findUniqueOrThrow({
      where: { id: seeded.northOccupiedSpot.id },
      select: { status: true },
    });
    assert.equal(updatedSpot.status, "maintenanceRequired");

    const myReports = await request(baseUrl, "/api/incident-reports/me", {
      headers: authHeaders(driverToken),
    });
    assert.equal(myReports.statusCode, 200);
    assert.equal(myReports.body.incidentReports.some((report) => report.id === incidentId), true);
    assertNoSensitiveData(myReports.body);

    const adminList = await request(baseUrl, "/api/admin/incident-reports?status=open", {
      headers: authHeaders(adminToken),
    });
    assert.equal(adminList.statusCode, 200);
    assert.equal(adminList.body.incidentReports.some((report) => report.id === incidentId), true);
    assertNoSensitiveData(adminList.body);

    const markInReview = await request(
      baseUrl,
      `/api/admin/incident-reports/${incidentId}/in-review`,
      {
        method: "PATCH",
        headers: authHeaders(adminToken),
      },
    );
    assert.equal(markInReview.statusCode, 200);
    assert.equal(markInReview.body.incidentReport.status, "inReview");
    assertNoSensitiveData(markInReview.body);

    const resolve = await request(baseUrl, `/api/admin/incident-reports/${incidentId}/resolve`, {
      method: "PATCH",
      headers: authHeaders(adminToken),
      body: {
        resolution: "Maintenance inspection scheduled and bay marked for review.",
      },
    });
    assert.equal(resolve.statusCode, 200);
    assert.equal(resolve.body.incidentReport.status, "resolved");
    assertNoSensitiveData(resolve.body);
  } finally {
    await close(server);
    await cleanup();
  }
});

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});
