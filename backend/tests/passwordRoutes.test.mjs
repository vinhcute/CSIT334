import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

process.env.AUTH_TOKEN_SECRET = "password-routes-test-secret";
process.env.AUTH_TOKEN_EXPIRES_IN = "1h";

const prisma = new PrismaClient();

const userInput = {
  name: "Password Routes Driver",
  universityId: "PASSWORD001",
  email: "password-routes@example.test",
  password: "old-password-value",
  newPassword: "new-password-value",
  licensePlate: "PASSWORD-001",
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

async function registerAndLogin(app, password = userInput.password) {
  await request(app, "/api/auth/register", {
    method: "POST",
    body: userInput,
  });

  const login = await request(app, "/api/auth/login", {
    method: "POST",
    body: {
      email: userInput.email,
      password,
    },
  });

  return login.body.token;
}

async function login(app, password) {
  return request(app, "/api/auth/login", {
    method: "POST",
    body: {
      email: userInput.email,
      password,
    },
  });
}

test("PATCH /api/password/change succeeds with the correct current password", async () => {
  const app = await createApp();
  await cleanup();

  try {
    const token = await registerAndLogin(app);
    const result = await request(app, "/api/password/change", {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}` },
      body: {
        currentPassword: userInput.password,
        newPassword: userInput.newPassword,
      },
    });

    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body, { success: true });
  } finally {
    await cleanup();
  }
});

test("PATCH /api/password/change fails with an incorrect current password", async () => {
  const app = await createApp();
  await cleanup();

  try {
    const token = await registerAndLogin(app);
    const result = await request(app, "/api/password/change", {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}` },
      body: {
        currentPassword: "not-the-current-password",
        newPassword: userInput.newPassword,
      },
    });

    assert.equal(result.statusCode, 401);
    assert.deepEqual(result.body, { error: "Current password is incorrect." });
  } finally {
    await cleanup();
  }
});

test("PATCH /api/password/change stores the new password as a hash", async () => {
  const app = await createApp();
  await cleanup();

  try {
    const token = await registerAndLogin(app);
    await request(app, "/api/password/change", {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}` },
      body: {
        currentPassword: userInput.password,
        newPassword: userInput.newPassword,
      },
    });
    const authRecord = await prisma.user.findUniqueOrThrow({
      where: { email: userInput.email },
      select: { passwordHash: true },
    });

    assert.notEqual(authRecord.passwordHash, userInput.newPassword);
    assert.equal(await bcrypt.compare(userInput.newPassword, authRecord.passwordHash), true);
  } finally {
    await cleanup();
  }
});

test("POST /api/password/reset-request returns the same generic response for existing and unknown emails", async () => {
  const app = await createApp();
  await cleanup();

  try {
    await registerAndLogin(app);
    const existing = await request(app, "/api/password/reset-request", {
      method: "POST",
      body: { email: userInput.email },
    });
    const unknown = await request(app, "/api/password/reset-request", {
      method: "POST",
      body: { email: "unknown-password-reset@example.test" },
    });

    assert.equal(existing.statusCode, 200);
    assert.equal(unknown.statusCode, 200);
    assert.deepEqual(existing.body, unknown.body);
    assert.deepEqual(existing.body, {
      success: true,
      message: "If an account exists for that email, a simulated reset instruction has been recorded.",
      simulated: true,
      emailSent: false,
    });
  } finally {
    await cleanup();
  }
});

test("Login succeeds with the changed password and fails with the old password", async () => {
  const app = await createApp();
  await cleanup();

  try {
    const token = await registerAndLogin(app);
    await request(app, "/api/password/change", {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}` },
      body: {
        currentPassword: userInput.password,
        newPassword: userInput.newPassword,
      },
    });

    const oldPasswordLogin = await login(app, userInput.password);
    const newPasswordLogin = await login(app, userInput.newPassword);

    assert.equal(oldPasswordLogin.statusCode, 401);
    assert.equal(newPasswordLogin.statusCode, 200);
    assert.equal(typeof newPasswordLogin.body.token, "string");
  } finally {
    await cleanup();
  }
});

test("PATCH /api/password/change returns 401 without authentication", async () => {
  const app = await createApp();

  const result = await request(app, "/api/password/change", {
    method: "PATCH",
    body: {
      currentPassword: userInput.password,
      newPassword: userInput.newPassword,
    },
  });

  assert.equal(result.statusCode, 401);
  assert.deepEqual(result.body, { error: "Authentication required." });
});

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});
