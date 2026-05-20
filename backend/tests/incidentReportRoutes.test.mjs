import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

process.env.AUTH_TOKEN_SECRET = "incident-report-routes-test-secret";
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

function makeIncident(overrides = {}) {
  return {
    id: "incident-1",
    userId: "driver-user-id",
    status: "open",
    issueType: "spotDiscrepancy",
    descriptionPreview:
      "Reserved bay was occupied by a different vehicle for over 15 minutes.",
    description:
      "Reserved bay was occupied by a different vehicle for over 15 minutes.",
    resolution: null,
    resolvedAt: null,
    createdAt: new Date("2026-05-21T00:00:00.000Z"),
    updatedAt: new Date("2026-05-21T00:00:00.000Z"),
    spot: {
      id: "spot-1",
      spotCode: "A-001",
      status: "occupied",
      level: "Ground",
      rowLabel: "A",
      zone: {
        id: "zone-1",
        name: "North Lot",
      },
    },
    reporter: {
      id: "driver-user-id",
      name: "Driver User",
      email: "driver@example.test",
    },
    ...overrides,
  };
}

async function createRouterApp({ role = "driver", serviceOverrides = {} } = {}) {
  const { createIncidentReportsRouter } = await import("../dist/routes/incidentReports.js");
  const app = express();
  const fakeService = {
    async createReport() {
      return makeIncident();
    },
    async listMyReports() {
      return [makeIncident()];
    },
    async listAdminReports() {
      return [makeIncident()];
    },
    async markInReview() {
      return makeIncident({ status: "inReview" });
    },
    async resolve() {
      return makeIncident({
        status: "resolved",
        resolution: "Issue fixed and bay is now compliant.",
        resolvedAt: new Date("2026-05-21T06:00:00.000Z"),
      });
    },
    ...serviceOverrides,
  };
  const fakeAuth = (request, _response, next) => {
    request.user = {
      userId: `${role}-user-id`,
      role,
      accountStatus: "active",
    };
    next();
  };

  app.use(express.json());
  app.use(createIncidentReportsRouter(fakeService, fakeAuth));

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

test("Incident routes are mounted on the real app and reject unauthenticated callers", async () => {
  const { createApp } = await import("../dist/index.js");
  const app = createApp();
  const mine = await request(app, "/api/incident-reports/me");
  const admin = await request(app, "/api/admin/incident-reports");

  assert.equal(mine.statusCode, 401);
  assert.deepEqual(mine.body, { error: "Authentication required." });
  assert.equal(admin.statusCode, 401);
  assert.deepEqual(admin.body, { error: "Authentication required." });
});

test("Authenticated users can create and list their own incident reports", async () => {
  const app = await createRouterApp({ role: "driver" });
  const created = await request(app, "/api/incident-reports", {
    method: "POST",
    body: {
      issueType: "spotDiscrepancy",
      description: "Reserved bay was occupied by a different vehicle for over 15 minutes.",
      spotId: "spot-1",
    },
  });
  const mine = await request(app, "/api/incident-reports/me");

  assert.equal(created.statusCode, 201);
  assert.equal(created.body.incidentReport.issueType, "spotDiscrepancy");
  assert.equal(mine.statusCode, 200);
  assert.equal(mine.body.incidentReports.length, 1);
  assertNoSensitiveData(created.body);
  assertNoSensitiveData(mine.body);
});

test("Admin-only incident routes reject authenticated non-admin users", async () => {
  const app = await createRouterApp({ role: "driver" });
  const adminList = await request(app, "/api/admin/incident-reports");
  const inReview = await request(app, "/api/admin/incident-reports/incident-1/in-review", {
    method: "PATCH",
  });

  assert.equal(adminList.statusCode, 403);
  assert.deepEqual(adminList.body, { error: "Forbidden." });
  assert.equal(inReview.statusCode, 403);
  assert.deepEqual(inReview.body, { error: "Forbidden." });
});

test("Authenticated admins can list, mark in-review, and resolve incident reports", async () => {
  const app = await createRouterApp({ role: "admin" });
  const listed = await request(
    app,
    "/api/admin/incident-reports?status=open&issueType=spotDiscrepancy&spotId=spot-1",
  );
  const inReview = await request(app, "/api/admin/incident-reports/incident-1/in-review", {
    method: "PATCH",
  });
  const resolved = await request(app, "/api/admin/incident-reports/incident-1/resolve", {
    method: "PATCH",
    body: {
      resolution: "Issue fixed and bay is now compliant.",
    },
  });

  assert.equal(listed.statusCode, 200);
  assert.equal(listed.body.incidentReports.length, 1);
  assert.equal(inReview.statusCode, 200);
  assert.equal(inReview.body.incidentReport.status, "inReview");
  assert.equal(resolved.statusCode, 200);
  assert.equal(resolved.body.incidentReport.status, "resolved");
  assertNoSensitiveData(listed.body);
  assertNoSensitiveData(inReview.body);
  assertNoSensitiveData(resolved.body);
});

test("Incident routes map validation and transition conflicts to controlled responses", async () => {
  const {
    IncidentReportValidationError,
    IncidentReportTransitionConflictError,
  } = await import("../dist/services/incidentReportService.js");
  const app = await createRouterApp({
    role: "admin",
    serviceOverrides: {
      async listAdminReports() {
        throw new IncidentReportValidationError(["Status filter is invalid."]);
      },
      async markInReview() {
        throw new IncidentReportTransitionConflictError(
          "Only open incident reports can be moved to in review.",
        );
      },
    },
  });
  const invalidList = await request(app, "/api/admin/incident-reports?status=invalid");
  const conflict = await request(app, "/api/admin/incident-reports/incident-1/in-review", {
    method: "PATCH",
  });

  assert.equal(invalidList.statusCode, 400);
  assert.deepEqual(invalidList.body, {
    error: "Incident report input is invalid.",
    issues: ["Status filter is invalid."],
  });
  assert.equal(conflict.statusCode, 409);
  assert.deepEqual(conflict.body, {
    error: "Only open incident reports can be moved to in review.",
  });
});
