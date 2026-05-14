import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

const adminUser = {
  userId: "admin-user",
  role: "admin",
  accountStatus: "active",
};

const driverUser = {
  userId: "driver-user",
  role: "driver",
  accountStatus: "active",
};

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0);
    server.once("listening", () => resolve(server));
    server.once("error", reject);
  });
}

async function requestAdmin(app) {
  const server = await listen(app);

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/admin`);
    const body = await response.json();

    return { statusCode: response.status, body };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function createAppWithUser(user) {
  const app = express();

  app.use((request, _response, next) => {
    request.user = user;
    next();
  });

  return app;
}

test("requireRole blocks a driver from an admin-only handler", async () => {
  const { requireRole } = await import("../dist/middleware/requireRole.js");
  const app = createAppWithUser(driverUser);

  app.get("/admin", requireRole("admin"), (_request, response) => {
    response.json({ ok: true });
  });

  const result = await requestAdmin(app);

  assert.equal(result.statusCode, 403);
  assert.deepEqual(result.body, { error: "Forbidden." });
});

test("requireRole allows an admin through an admin-only handler", async () => {
  const { requireRole } = await import("../dist/middleware/requireRole.js");
  const app = createAppWithUser(adminUser);

  app.get("/admin", requireRole("admin"), (_request, response) => {
    response.json({ ok: true });
  });

  const result = await requestAdmin(app);

  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, { ok: true });
});

test("requireRole returns 401 when request.user is missing", async () => {
  const { requireRole } = await import("../dist/middleware/requireRole.js");
  const app = express();

  app.get("/admin", requireRole("admin"), (_request, response) => {
    response.json({ ok: true });
  });

  const result = await requestAdmin(app);

  assert.equal(result.statusCode, 401);
  assert.deepEqual(result.body, { error: "Authentication required." });
});
