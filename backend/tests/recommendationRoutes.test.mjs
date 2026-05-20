import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

process.env.AUTH_TOKEN_SECRET = "recommendation-routes-test-secret";
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

async function createRouterApp({ role = "driver" } = {}) {
  const { createRecommendationsRouter } = await import("../dist/routes/recommendations.js");
  const app = express();
  const recommendation = {
    type: "nearestAvailableZone",
    zoneId: "zone-a",
    zoneName: "Zone A",
    distanceFromEntryMeters: 120,
    displayOrder: 1,
    capacity: 10,
    availableSpots: 4,
    occupiedSpots: 3,
    reservedSpots: 1,
    maintenanceRequiredSpots: 1,
    occupancyRate: 40,
    reason: "4 available spots, 40.00% occupied, 120m from entry.",
  };
  const leastCongested = {
    ...recommendation,
    type: "leastCongestedZone",
    zoneId: "zone-b",
    zoneName: "Zone B",
    distanceFromEntryMeters: 180,
    occupancyRate: 20,
  };
  const generatedAt = new Date("2026-05-20T00:00:00.000Z");
  const fakeService = {
    async getNearestAvailableZone() {
      return recommendation;
    },
    async getLeastCongestedZone() {
      return leastCongested;
    },
    async getZoneRecommendations() {
      return {
        nearestAvailableZone: recommendation,
        leastCongestedZone: leastCongested,
        recommendations: [leastCongested, recommendation],
        generatedAt,
      };
    },
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
  app.use(createRecommendationsRouter(fakeService, fakeAuth));

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

test("Recommendation routes are mounted on the real app and reject unauthenticated callers", async () => {
  const { createApp } = await import("../dist/index.js");
  const app = createApp();
  const result = await request(app, "/api/recommendations/nearest-zone");

  assert.equal(result.statusCode, 401);
  assert.deepEqual(result.body, { error: "Authentication required." });
});

test("Authenticated driver can read nearest and least-congested recommendations", async () => {
  const app = await createRouterApp({ role: "driver" });
  const nearest = await request(app, "/api/recommendations/nearest-zone");
  const leastCongested = await request(app, "/api/recommendations/least-congested-zone");

  assert.equal(nearest.statusCode, 200);
  assert.equal(nearest.body.recommendation.zoneId, "zone-a");
  assert.equal(nearest.body.recommendation.type, "nearestAvailableZone");
  assert.equal(leastCongested.statusCode, 200);
  assert.equal(leastCongested.body.recommendation.zoneId, "zone-b");
  assert.equal(leastCongested.body.recommendation.type, "leastCongestedZone");
  assertNoSensitiveData(nearest.body);
  assertNoSensitiveData(leastCongested.body);
});

test("Authenticated admin can read combined zone recommendations", async () => {
  const app = await createRouterApp({ role: "admin" });
  const result = await request(app, "/api/recommendations/zones");

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.recommendations.nearestAvailableZone.zoneId, "zone-a");
  assert.equal(result.body.recommendations.leastCongestedZone.zoneId, "zone-b");
  assert.equal(result.body.recommendations.recommendations.length, 2);
  assert.equal(result.body.recommendations.generatedAt, "2026-05-20T00:00:00.000Z");
  assertNoSensitiveData(result.body);
});
