import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

process.env.AUTH_TOKEN_SECRET = "analytics-routes-test-secret";
process.env.AUTH_TOKEN_EXPIRES_IN = "1h";

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

async function createRouterApp({ role = "admin", serviceOverrides = {} } = {}) {
  const { createAnalyticsRouter } = await import("../dist/routes/analytics.js");
  const app = express();
  const generatedAt = new Date("2026-05-20T00:00:00.000Z");
  const trend = {
    recordedAt: generatedAt,
    zoneId: "zone-a",
    zoneName: "North Zone",
    capacity: 10,
    availableSpots: 4,
    occupiedSpots: 5,
    reservedSpots: 1,
    occupancyRate: 60,
  };
  const peakHour = {
    hour: 8,
    hourLabel: "8 AM",
    averageOccupancyRate: 72.5,
    sampleCount: 4,
  };
  const zoneUtilisation = {
    zoneId: "zone-a",
    zoneName: "North Zone",
    capacity: 10,
    availableSpots: 4,
    occupiedSpots: 5,
    reservedSpots: 1,
    maintenanceRequiredSpots: 0,
    utilisationRate: 60,
  };
  const fakeService = {
    async getOccupancyTrends() {
      return [trend];
    },
    async getPeakHours() {
      return [peakHour];
    },
    async getZoneUtilisation() {
      return [zoneUtilisation];
    },
    async getSummary() {
      return {
        range: "today",
        generatedAt,
        totalCapacity: 10,
        totalAvailableSpots: 4,
        totalOccupiedSpots: 5,
        totalReservedSpots: 1,
        totalMaintenanceRequiredSpots: 0,
        averageOccupancyRate: 60,
        openIncidentCount: null,
        occupancyTrends: [trend],
        peakHours: [peakHour],
        zoneUtilisation: [zoneUtilisation],
      };
    },
    ...serviceOverrides,
  };
  const fakeAuth = (request, _response, next) => {
    request.user = {
      sub: `${role}-user-id`,
      email: `${role}@example.test`,
      role,
      accountStatus: "active",
    };
    next();
  };

  app.use(express.json());
  app.use(createAnalyticsRouter(fakeService, fakeAuth));

  return app;
}

function assertNoSensitiveData(value) {
  const serialized = JSON.stringify(value);

  assert.equal(serialized.includes("passwordHash"), false);
  assert.equal(serialized.includes("token"), false);
  assert.equal(serialized.includes("universityId"), false);
  assert.equal(serialized.includes("licensePlate"), false);
  assert.equal(serialized.includes("licencePlate"), false);
}

test("Analytics routes are mounted on the real app and reject unauthenticated callers", async () => {
  const { createApp } = await import("../dist/index.js");
  const app = createApp();
  const result = await request(app, "/api/admin/analytics/summary");

  assert.equal(result.statusCode, 401);
  assert.deepEqual(result.body, { error: "Authentication required." });
});

test("Analytics routes reject authenticated non-admin users", async () => {
  const app = await createRouterApp({ role: "driver" });
  const result = await request(app, "/api/admin/analytics/summary");

  assert.equal(result.statusCode, 403);
  assert.deepEqual(result.body, { error: "Forbidden." });
});

test("Authenticated admins can read analytics endpoints", async () => {
  const app = await createRouterApp({ role: "admin" });

  const trends = await request(app, "/api/admin/analytics/occupancy-trends?range=week");
  const peakHours = await request(app, "/api/admin/analytics/peak-hours?range=week");
  const utilisation = await request(app, "/api/admin/analytics/zone-utilisation");
  const summary = await request(app, "/api/admin/analytics/summary?range=week");

  assert.equal(trends.statusCode, 200);
  assert.equal(trends.body.occupancyTrends[0].recordedAt, "2026-05-20T00:00:00.000Z");
  assert.equal(peakHours.statusCode, 200);
  assert.equal(peakHours.body.peakHours[0].hourLabel, "8 AM");
  assert.equal(utilisation.statusCode, 200);
  assert.equal(utilisation.body.zoneUtilisation[0].zoneId, "zone-a");
  assert.equal(summary.statusCode, 200);
  assert.equal(summary.body.summary.generatedAt, "2026-05-20T00:00:00.000Z");
  assertNoSensitiveData(trends.body);
  assertNoSensitiveData(peakHours.body);
  assertNoSensitiveData(utilisation.body);
  assertNoSensitiveData(summary.body);
});

test("Analytics routes return clear validation errors", async () => {
  const { AnalyticsValidationError } = await import("../dist/services/analyticsService.js");
  const app = await createRouterApp({
    serviceOverrides: {
      async getOccupancyTrends() {
        throw new AnalyticsValidationError(["Range must be one of: today, week, month."]);
      },
    },
  });
  const result = await request(app, "/api/admin/analytics/occupancy-trends?range=year");

  assert.equal(result.statusCode, 400);
  assert.equal(result.body.error, "Analytics request is invalid.");
  assert.deepEqual(result.body.issues, ["Range must be one of: today, week, month."]);
});
