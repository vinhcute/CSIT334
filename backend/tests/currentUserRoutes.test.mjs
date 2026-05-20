import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

process.env.AUTH_TOKEN_SECRET = "current-user-routes-test-secret";
process.env.AUTH_TOKEN_EXPIRES_IN = "1h";

const prisma = new PrismaClient();

const userInput = {
  name: "Current User Routes Driver",
  universityId: "CURRENTUSER001",
  email: "current-user-routes@example.test",
  password: "current-user-password",
  licensePlate: "CURRENT-001",
};

async function cleanup() {
  await prisma.user.deleteMany({
    where: {
      OR: [{ email: userInput.email }, { universityId: userInput.universityId }],
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
    const body = await response.json();

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

async function registerAndLogin(app) {
  await request(app, "/api/auth/register", {
    method: "POST",
    body: userInput,
  });

  const login = await request(app, "/api/auth/login", {
    method: "POST",
    body: {
      email: userInput.email,
      password: userInput.password,
    },
  });

  return login.body.token;
}

test("GET /api/users/me returns the authenticated user's safe profile", async () => {
  const app = await createApp();
  await cleanup();

  try {
    const token = await registerAndLogin(app);
    const result = await request(app, "/api/users/me", {
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.user.email, userInput.email);
    assert.equal(result.body.user.universityId, userInput.universityId);
    assert.equal(result.body.user.role, "driver");
    assert.equal(result.body.user.accountStatus, "active");
    assert.equal(Object.hasOwn(result.body.user, "passwordHash"), false);
  } finally {
    await cleanup();
  }
});

test("GET /api/users/me returns 401 without a valid token", async () => {
  const app = await createApp();

  const missing = await request(app, "/api/users/me");
  const invalid = await request(app, "/api/users/me", {
    headers: { authorization: "Bearer invalid-token" },
  });

  assert.equal(missing.statusCode, 401);
  assert.deepEqual(missing.body, { error: "Authentication required." });
  assert.equal(invalid.statusCode, 401);
  assert.deepEqual(invalid.body, { error: "Authentication required." });
});

test("GET /health still works after mounting auth routes", async () => {
  const app = await createApp();

  const result = await request(app, "/health");

  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, {
    status: "ok",
    database: "reachable",
  });
});

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});
