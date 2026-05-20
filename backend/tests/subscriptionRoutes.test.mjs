import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

process.env.AUTH_TOKEN_SECRET = "subscription-routes-test-secret";
process.env.AUTH_TOKEN_EXPIRES_IN = "1h";

const prisma = new PrismaClient();

const userInput = {
  name: "Subscription Routes Driver",
  universityId: "SUBSCRIPTION001",
  email: "subscription-routes@example.test",
  password: "subscription-password",
  licensePlate: "SUBSCRIPTION-001",
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

async function createSubscription(app, token, type) {
  return request(app, "/api/subscriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: { type },
  });
}

function assertDurationDays(subscription, expectedDays) {
  const startTime = new Date(subscription.startTime);
  const endTime = new Date(subscription.endTime);
  const actualDays = (endTime.getTime() - startTime.getTime()) / (24 * 60 * 60 * 1000);

  assert.equal(actualDays, expectedDays);
}

test("POST /api/subscriptions creates an active daily subscription", async () => {
  const app = await createApp();
  await cleanup();

  try {
    const token = await registerAndLogin(app);
    const result = await createSubscription(app, token, "daily");

    assert.equal(result.statusCode, 201);
    assert.equal(result.body.subscription.type, "daily");
    assert.equal(result.body.subscription.status, "active");
    assertDurationDays(result.body.subscription, 1);
    assert.match(result.body.message, /Simulated subscription/);
    assert.match(result.body.message, /no payment was processed/);
  } finally {
    await cleanup();
  }
});

test("POST /api/subscriptions creates an active weekly subscription", async () => {
  const app = await createApp();
  await cleanup();

  try {
    const token = await registerAndLogin(app);
    const result = await createSubscription(app, token, "weekly");

    assert.equal(result.statusCode, 201);
    assert.equal(result.body.subscription.type, "weekly");
    assert.equal(result.body.subscription.status, "active");
    assertDurationDays(result.body.subscription, 7);
  } finally {
    await cleanup();
  }
});

test("POST /api/subscriptions creates an active monthly subscription", async () => {
  const app = await createApp();
  await cleanup();

  try {
    const token = await registerAndLogin(app);
    const result = await createSubscription(app, token, "monthly");

    assert.equal(result.statusCode, 201);
    assert.equal(result.body.subscription.type, "monthly");
    assert.equal(result.body.subscription.status, "active");
    assertDurationDays(result.body.subscription, 30);
  } finally {
    await cleanup();
  }
});

test("POST /api/subscriptions returns a validation error for invalid type", async () => {
  const app = await createApp();
  await cleanup();

  try {
    const token = await registerAndLogin(app);
    const result = await createSubscription(app, token, "semester");

    assert.equal(result.statusCode, 400);
    assert.equal(result.body.error, "Subscription input is invalid.");
    assert.equal(result.body.issues.length, 1);
  } finally {
    await cleanup();
  }
});

test("POST /api/subscriptions returns 401 without authentication", async () => {
  const app = await createApp();

  const result = await request(app, "/api/subscriptions", {
    method: "POST",
    body: { type: "daily" },
  });

  assert.equal(result.statusCode, 401);
  assert.deepEqual(result.body, { error: "Authentication required." });
});

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});
