import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

const payload = {
  userId: "middleware-user",
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

async function request(app, options = {}) {
  const server = await listen(app);

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/protected`, {
      headers: options.headers,
    });
    const body = await response.json();

    return { statusCode: response.status, body };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("auth middleware attaches request.user for a valid bearer token", async () => {
  const { TokenService } = await import("../dist/services/tokenService.js");
  const { createAuthMiddleware } = await import("../dist/middleware/authMiddleware.js");
  const tokenService = new TokenService({ secret: "middleware-secret", expiresIn: "1h" });
  const token = tokenService.signToken(payload);
  const app = express();

  app.get("/protected", createAuthMiddleware(tokenService), (request, response) => {
    response.json({ user: request.user });
  });

  const result = await request(app, {
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.user.userId, payload.userId);
  assert.equal(result.body.user.role, payload.role);
  assert.equal(result.body.user.accountStatus, payload.accountStatus);
  assert.equal(typeof result.body.user.iat, "number");
  assert.equal(typeof result.body.user.exp, "number");
});

test("auth middleware returns 401 when the bearer token is missing", async () => {
  const { TokenService } = await import("../dist/services/tokenService.js");
  const { createAuthMiddleware } = await import("../dist/middleware/authMiddleware.js");
  const tokenService = new TokenService({ secret: "middleware-secret", expiresIn: "1h" });
  const app = express();

  app.get("/protected", createAuthMiddleware(tokenService), (_request, response) => {
    response.json({ ok: true });
  });

  const result = await request(app);

  assert.equal(result.statusCode, 401);
  assert.deepEqual(result.body, { error: "Authentication required." });
});

test("auth middleware returns 401 when the bearer token is invalid", async () => {
  const { TokenService } = await import("../dist/services/tokenService.js");
  const { createAuthMiddleware } = await import("../dist/middleware/authMiddleware.js");
  const tokenService = new TokenService({ secret: "middleware-secret", expiresIn: "1h" });
  const app = express();

  app.get("/protected", createAuthMiddleware(tokenService), (_request, response) => {
    response.json({ ok: true });
  });

  const result = await request(app, {
    headers: { authorization: "Bearer not-a-real-token" },
  });

  assert.equal(result.statusCode, 401);
  assert.deepEqual(result.body, { error: "Authentication required." });
});
