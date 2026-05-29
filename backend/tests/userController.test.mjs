import assert from "node:assert/strict";
import test from "node:test";

async function loadController() {
  return import("../dist/controllers/userController.js");
}

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function createRepository(overrides = {}) {
  return {
    async findById() {
      return null;
    },
    async findByEmail(email) {
      return overrides.emailUserByEmail?.[email] ?? null;
    },
    async findByUniversityId(universityId) {
      return overrides.userByUniversityId?.[universityId] ?? null;
    },
    async updateProfile(userId, input) {
      return {
        id: userId,
        ...input,
        role: "driver",
        accountStatus: "active",
        passwordHash: "hidden-password-hash",
      };
    },
  };
}

test("UserController updateMe updates safe editable profile fields", async () => {
  const { UserController } = await loadController();
  const controller = new UserController(createRepository());
  const response = createResponse();

  await controller.updateMe(
    {
      user: { userId: "user-1" },
      body: {
        name: "Updated User",
        email: "Updated.User@Example.Test",
        universityId: "UPDATED001",
        role: "admin",
        accountStatus: "disabled",
      },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.user.name, "Updated User");
  assert.equal(response.body.user.email, "updated.user@example.test");
  assert.equal(response.body.user.universityId, "UPDATED001");
  assert.equal(response.body.user.role, "driver");
  assert.equal(response.body.user.accountStatus, "active");
  assert.equal(Object.hasOwn(response.body.user, "passwordHash"), false);
});

test("UserController updateMe rejects duplicate profile identifiers", async () => {
  const { UserController } = await loadController();
  const controller = new UserController(
    createRepository({
      emailUserByEmail: {
        "taken@example.test": { id: "other-user" },
      },
      userByUniversityId: {
        TAKEN001: { id: "other-user" },
      },
    }),
  );
  const duplicateEmailResponse = createResponse();
  const duplicateUniversityResponse = createResponse();

  await controller.updateMe(
    {
      user: { userId: "user-1" },
      body: {
        name: "Updated User",
        email: "taken@example.test",
        universityId: "UPDATED001",
      },
    },
    duplicateEmailResponse,
  );

  await controller.updateMe(
    {
      user: { userId: "user-1" },
      body: {
        name: "Updated User",
        email: "updated@example.test",
        universityId: "TAKEN001",
      },
    },
    duplicateUniversityResponse,
  );

  assert.equal(duplicateEmailResponse.statusCode, 409);
  assert.deepEqual(duplicateEmailResponse.body, { error: "Email is already in use." });
  assert.equal(duplicateUniversityResponse.statusCode, 409);
  assert.deepEqual(duplicateUniversityResponse.body, {
    error: "University ID is already in use.",
  });
});

test("UserController updateMe validates profile input and authentication", async () => {
  const { UserController } = await loadController();
  const controller = new UserController(createRepository());
  const invalidResponse = createResponse();
  const unauthenticatedResponse = createResponse();

  await controller.updateMe(
    {
      user: { userId: "user-1" },
      body: {
        name: "",
        email: "invalid",
        universityId: "",
      },
    },
    invalidResponse,
  );
  await controller.updateMe({ body: {} }, unauthenticatedResponse);

  assert.equal(invalidResponse.statusCode, 400);
  assert.deepEqual(invalidResponse.body, { error: "Name is required." });
  assert.equal(unauthenticatedResponse.statusCode, 401);
  assert.deepEqual(unauthenticatedResponse.body, { error: "Authentication required." });
});
