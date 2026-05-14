import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

process.env.AUTH_TOKEN_SECRET = "vehicle-profile-routes-test-secret";
process.env.AUTH_TOKEN_EXPIRES_IN = "1h";

const prisma = new PrismaClient();

const firstUser = {
  name: "Vehicle Profile Owner",
  universityId: "VEHICLE001",
  email: "vehicle-profile-owner@example.test",
  password: "vehicle-profile-password",
  licensePlate: "VEHICLE-001",
};

const secondUser = {
  name: "Vehicle Profile Other Owner",
  universityId: "VEHICLE002",
  email: "vehicle-profile-other@example.test",
  password: "vehicle-profile-password",
  licensePlate: "VEHICLE-002",
};

async function cleanup() {
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: firstUser.email },
        { email: secondUser.email },
        { universityId: firstUser.universityId },
        { universityId: secondUser.universityId },
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

async function registerAndLogin(app, input) {
  await request(app, "/api/auth/register", {
    method: "POST",
    body: input,
  });

  const login = await request(app, "/api/auth/login", {
    method: "POST",
    body: {
      email: input.email,
      password: input.password,
    },
  });

  return login.body.token;
}

test("GET /api/vehicle-profiles/me returns only the authenticated user's vehicles", async () => {
  const app = await createApp();
  await cleanup();

  try {
    const firstToken = await registerAndLogin(app, firstUser);
    await registerAndLogin(app, secondUser);

    const result = await request(app, "/api/vehicle-profiles/me", {
      headers: { authorization: `Bearer ${firstToken}` },
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.vehicleProfiles.length, 1);
    assert.equal(result.body.vehicleProfiles[0].licensePlate, firstUser.licensePlate);
    assert.equal(
      result.body.vehicleProfiles.some((profile) => profile.licensePlate === secondUser.licensePlate),
      false,
    );
    assert.equal(Object.hasOwn(result.body.vehicleProfiles[0], "user"), false);
  } finally {
    await cleanup();
  }
});

test("POST /api/vehicle-profiles creates a vehicle for the authenticated user", async () => {
  const app = await createApp();
  await cleanup();

  try {
    const token = await registerAndLogin(app, firstUser);
    const result = await request(app, "/api/vehicle-profiles", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: {
        licensePlate: "VEHICLE-NEW",
        vehicleMake: "Honda",
        vehicleModel: "Civic",
        vehicleColor: "Black",
      },
    });

    assert.equal(result.statusCode, 201);
    assert.equal(result.body.vehicleProfile.licensePlate, "VEHICLE-NEW");
    assert.equal(result.body.vehicleProfile.vehicleMake, "Honda");
    assert.equal(Object.hasOwn(result.body.vehicleProfile, "user"), false);
  } finally {
    await cleanup();
  }
});

test("PATCH /api/vehicle-profiles/:id updates a vehicle owned by the user", async () => {
  const app = await createApp();
  await cleanup();

  try {
    const token = await registerAndLogin(app, firstUser);
    const list = await request(app, "/api/vehicle-profiles/me", {
      headers: { authorization: `Bearer ${token}` },
    });
    const vehicleProfileId = list.body.vehicleProfiles[0].id;

    const result = await request(app, `/api/vehicle-profiles/${vehicleProfileId}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}` },
      body: {
        licensePlate: "VEHICLE-UPDATED",
        vehicleColor: "Green",
      },
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.vehicleProfile.licensePlate, "VEHICLE-UPDATED");
    assert.equal(result.body.vehicleProfile.vehicleColor, "Green");
  } finally {
    await cleanup();
  }
});

test("PATCH /api/vehicle-profiles/:id blocks updates to another user's vehicle", async () => {
  const app = await createApp();
  await cleanup();

  try {
    const firstToken = await registerAndLogin(app, firstUser);
    const secondToken = await registerAndLogin(app, secondUser);
    const secondList = await request(app, "/api/vehicle-profiles/me", {
      headers: { authorization: `Bearer ${secondToken}` },
    });
    const secondVehicleProfileId = secondList.body.vehicleProfiles[0].id;

    const result = await request(app, `/api/vehicle-profiles/${secondVehicleProfileId}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${firstToken}` },
      body: { vehicleColor: "Purple" },
    });

    assert.equal(result.statusCode, 404);
    assert.deepEqual(result.body, { error: "Vehicle profile not found." });
  } finally {
    await cleanup();
  }
});

test("POST /api/vehicle-profiles rejects duplicate licence plates", async () => {
  const app = await createApp();
  await cleanup();

  try {
    const token = await registerAndLogin(app, firstUser);
    const result = await request(app, "/api/vehicle-profiles", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: {
        licensePlate: firstUser.licensePlate,
      },
    });

    assert.equal(result.statusCode, 409);
    assert.deepEqual(result.body, {
      error: "A vehicle with this licence plate already exists.",
    });
  } finally {
    await cleanup();
  }
});

test("Vehicle profile routes return 401 without authentication", async () => {
  const app = await createApp();

  const result = await request(app, "/api/vehicle-profiles/me");

  assert.equal(result.statusCode, 401);
  assert.deepEqual(result.body, { error: "Authentication required." });
});

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});
