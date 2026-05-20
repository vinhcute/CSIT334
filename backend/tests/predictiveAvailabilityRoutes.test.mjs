import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

process.env.AUTH_TOKEN_SECRET = "predictive-availability-routes-test-secret";
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

async function createRouterApp({ role = "driver", serviceOverrides = {} } = {}) {
  const { createPredictiveAvailabilityRouter } = await import(
    "../dist/routes/predictiveAvailability.js"
  );
  const targetTime = new Date("2026-05-27T07:30:00.000Z");
  const prediction = {
    zoneId: "zone-a",
    zoneName: "Zone A",
    targetTime,
    capacity: 100,
    predictedAvailableSpots: 42,
    predictedOccupancyRate: 58,
    availabilityProbability: 42,
    confidenceLabel: "medium",
    historicalSampleCount: 4,
    basis: "Based on 4 historical samples from the same weekday and hour.",
  };
  const fakeService = {
    async predictAvailability(input) {
      return {
        ...prediction,
        zoneId: input.zoneId,
        targetTime: input.targetTime,
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
  const app = express();

  app.use(express.json());
  app.use(createPredictiveAvailabilityRouter(fakeService, fakeAuth));

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

test("Predictive availability route is mounted on the real app and rejects unauthenticated callers", async () => {
  const { createApp } = await import("../dist/index.js");
  const app = createApp();
  const result = await request(
    app,
    "/api/predictive-availability?zoneId=zone-a&targetTime=2026-05-27T07%3A30%3A00.000Z",
  );

  assert.equal(result.statusCode, 401);
  assert.deepEqual(result.body, { error: "Authentication required." });
});

test("Authenticated driver can request predictive availability", async () => {
  const app = await createRouterApp({ role: "driver" });
  const result = await request(
    app,
    "/api/predictive-availability?zoneId=zone-a&targetTime=2026-05-27T07%3A30%3A00.000Z",
  );

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.prediction.zoneId, "zone-a");
  assert.equal(result.body.prediction.targetTime, "2026-05-27T07:30:00.000Z");
  assert.equal(result.body.prediction.predictedAvailableSpots, 42);
  assert.equal(result.body.prediction.confidenceLabel, "medium");
  assertNoSensitiveData(result.body);
});

test("Authenticated admin can request predictive availability", async () => {
  const app = await createRouterApp({ role: "admin" });
  const result = await request(
    app,
    "/api/predictive-availability?zoneId=zone-b&targetTime=2026-05-27T07%3A30%3A00.000Z",
  );

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.prediction.zoneId, "zone-b");
  assert.equal(result.body.prediction.capacity, 100);
  assertNoSensitiveData(result.body);
});

test("Predictive availability route returns clear validation errors", async () => {
  const { PredictiveAvailabilityValidationError } = await import(
    "../dist/services/predictiveAvailabilityService.js"
  );
  const app = await createRouterApp({
    serviceOverrides: {
      async predictAvailability() {
        throw new PredictiveAvailabilityValidationError([
          "Parking zone ID is required.",
          "Target time must be a valid date.",
        ]);
      },
    },
  });
  const result = await request(app, "/api/predictive-availability");

  assert.equal(result.statusCode, 400);
  assert.equal(result.body.error, "Predictive availability input is invalid.");
  assert.deepEqual(result.body.issues, [
    "Parking zone ID is required.",
    "Target time must be a valid date.",
  ]);
});

test("Predictive availability route returns not found for unknown zones", async () => {
  const { PredictiveAvailabilityZoneNotFoundError } = await import(
    "../dist/services/predictiveAvailabilityService.js"
  );
  const app = await createRouterApp({
    serviceOverrides: {
      async predictAvailability() {
        throw new PredictiveAvailabilityZoneNotFoundError();
      },
    },
  });
  const result = await request(
    app,
    "/api/predictive-availability?zoneId=missing-zone&targetTime=2026-05-27T07%3A30%3A00.000Z",
  );

  assert.equal(result.statusCode, 404);
  assert.deepEqual(result.body, { error: "Parking zone not found." });
});
