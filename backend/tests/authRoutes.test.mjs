import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

process.env.AUTH_TOKEN_SECRET = "auth-routes-test-secret";
process.env.AUTH_TOKEN_EXPIRES_IN = "1h";

const prisma = new PrismaClient();

const registerInput = {
  name: "Auth Routes Driver",
  universityId: "AUTHROUTES001",
  email: "Auth.Routes.Driver@Example.Test",
  password: "auth-routes-password",
  licensePlate: "AUTH-ROUTES-001",
  vehicleMake: "Toyota",
  vehicleModel: "Corolla",
  vehicleColor: "Silver",
};

async function cleanup() {
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: registerInput.email.toLowerCase() },
        { universityId: registerInput.universityId },
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

test("POST /api/auth/register creates a driver and returns safe user data", async () => {
  const app = await createApp();
  await cleanup();

  try {
    const result = await request(app, "/api/auth/register", {
      method: "POST",
      body: registerInput,
    });

    assert.equal(result.statusCode, 201);
    assert.equal(result.body.user.email, registerInput.email.toLowerCase());
    assert.equal(result.body.user.role, "driver");
    assert.equal(result.body.user.vehicleProfiles.length, 1);
    assert.equal(result.body.user.vehicleProfiles[0].licensePlate, registerInput.licensePlate);
    assert.equal(Object.hasOwn(result.body.user, "passwordHash"), false);
  } finally {
    await cleanup();
  }
});

test("POST /api/auth/login returns a token for valid credentials", async () => {
  const app = await createApp();
  await cleanup();

  try {
    await request(app, "/api/auth/register", {
      method: "POST",
      body: registerInput,
    });

    const result = await request(app, "/api/auth/login", {
      method: "POST",
      body: {
        email: registerInput.email,
        password: registerInput.password,
      },
    });

    assert.equal(result.statusCode, 200);
    assert.equal(typeof result.body.token, "string");
    assert.equal(result.body.user.email, registerInput.email.toLowerCase());
    assert.equal(Object.hasOwn(result.body.user, "passwordHash"), false);
  } finally {
    await cleanup();
  }
});

test("POST /api/auth/login rejects invalid credentials", async () => {
  const app = await createApp();
  await cleanup();

  try {
    await request(app, "/api/auth/register", {
      method: "POST",
      body: registerInput,
    });

    const result = await request(app, "/api/auth/login", {
      method: "POST",
      body: {
        email: registerInput.email,
        password: "wrong-password",
      },
    });

    assert.equal(result.statusCode, 401);
    assert.deepEqual(result.body, { error: "Email or password is incorrect." });
  } finally {
    await cleanup();
  }
});

test("POST /api/auth/logout returns successful token discard response", async () => {
  const app = await createApp();

  const result = await request(app, "/api/auth/logout", {
    method: "POST",
  });

  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, {
    success: true,
    strategy: "clientTokenDiscard",
  });
});

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});
