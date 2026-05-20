import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const activeUser = {
  id: "auth-service-active-user",
  name: "Auth Service Active User",
  email: "auth-service-active@example.test",
  universityId: "AUTH001",
  licensePlate: "AUTH-001",
  password: "auth-service-password",
};

const disabledUser = {
  id: "auth-service-disabled-user",
  name: "Auth Service Disabled User",
  email: "auth-service-disabled@example.test",
  universityId: "AUTH002",
  licensePlate: "AUTH-002",
  password: "disabled-password",
};

async function cleanup() {
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: activeUser.email },
        { email: disabledUser.email },
        { universityId: activeUser.universityId },
        { universityId: disabledUser.universityId },
      ],
    },
  });
}

async function createAuthServiceFixture() {
  const { AuthService } = await import("../dist/services/authService.js");
  const { PasswordService } = await import("../dist/services/passwordService.js");
  const { TokenService } = await import("../dist/services/tokenService.js");
  const { UserRepository } = await import("../dist/repositories/userRepository.js");

  const passwordService = new PasswordService();
  const userRepository = new UserRepository(prisma);
  const tokenService = new TokenService({
    secret: "auth-service-test-secret",
    expiresIn: "1h",
  });

  await cleanup();

  await userRepository.createDriverWithVehicle({
    name: activeUser.name,
    email: activeUser.email,
    universityId: activeUser.universityId,
    licensePlate: activeUser.licensePlate,
    passwordHash: await passwordService.hashPassword(activeUser.password),
  });

  const disabled = await userRepository.createDriverWithVehicle({
    name: disabledUser.name,
    email: disabledUser.email,
    universityId: disabledUser.universityId,
    licensePlate: disabledUser.licensePlate,
    passwordHash: await passwordService.hashPassword(disabledUser.password),
  });
  await userRepository.updateAccountStatus(disabled.id, "disabled");

  return {
    authService: new AuthService(userRepository, passwordService, tokenService),
    tokenService,
  };
}

test("AuthService logs in an active user with valid credentials", async () => {
  const { authService, tokenService } = await createAuthServiceFixture();

  try {
    const result = await authService.login({
      email: activeUser.email.toUpperCase(),
      password: activeUser.password,
    });
    const payload = tokenService.verifyToken(result.token);

    assert.equal(typeof result.token, "string");
    assert.equal(result.user.email, activeUser.email);
    assert.equal(result.user.role, "driver");
    assert.equal(result.user.accountStatus, "active");
    assert.equal(Object.hasOwn(result.user, "passwordHash"), false);
    assert.equal(payload.userId, result.user.id);
    assert.equal(payload.role, result.user.role);
    assert.equal(payload.accountStatus, result.user.accountStatus);
  } finally {
    await cleanup();
  }
});

test("AuthService rejects incorrect credentials with a generic error", async () => {
  const { InvalidCredentialsError } = await import("../dist/services/authService.js");
  const { authService } = await createAuthServiceFixture();

  try {
    await assert.rejects(
      () =>
        authService.login({
          email: activeUser.email,
          password: "wrong-password",
        }),
      InvalidCredentialsError,
    );

    await assert.rejects(
      () =>
        authService.login({
          email: "unknown@example.test",
          password: activeUser.password,
        }),
      InvalidCredentialsError,
    );
  } finally {
    await cleanup();
  }
});

test("AuthService blocks disabled accounts", async () => {
  const { AccountDisabledError } = await import("../dist/services/authService.js");
  const { authService } = await createAuthServiceFixture();

  try {
    await assert.rejects(
      () =>
        authService.login({
          email: disabledUser.email,
          password: disabledUser.password,
        }),
      AccountDisabledError,
    );
  } finally {
    await cleanup();
  }
});

test("AuthService documents logout as client token discard", async () => {
  const { authService } = await createAuthServiceFixture();

  try {
    assert.deepEqual(authService.logout(), {
      success: true,
      strategy: "clientTokenDiscard",
    });
  } finally {
    await cleanup();
  }
});

test.after(async () => {
  await prisma.$disconnect();
});
