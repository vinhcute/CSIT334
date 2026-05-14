import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const baseInput = {
  name: "Registration Test Driver",
  universityId: "REG001",
  email: "Registration.Driver@Example.Test",
  password: "registration-password",
  licensePlate: "REG-001",
  vehicleMake: "Mazda",
  vehicleModel: "CX-5",
  vehicleColor: "Blue",
};

async function cleanup() {
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: baseInput.email.toLowerCase() },
        { email: "duplicate-email@example.test" },
        { universityId: baseInput.universityId },
        { universityId: "REG002" },
        { universityId: "REG003" },
        { universityId: "REG004" },
      ],
    },
  });
}

async function createService() {
  const { RegistrationService } = await import("../dist/services/registrationService.js");

  return new RegistrationService();
}

test("RegistrationService registers a driver with an initial vehicle profile", async () => {
  const registrationService = await createService();
  await cleanup();

  try {
    const user = await registrationService.registerDriver(baseInput);
    const authRecord = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { vehicleProfiles: true },
    });

    assert.equal(user.role, "driver");
    assert.equal(user.accountStatus, "active");
    assert.equal(user.email, baseInput.email.toLowerCase());
    assert.equal(user.vehicleProfiles.length, 1);
    assert.equal(user.vehicleProfiles[0].licensePlate, baseInput.licensePlate);
    assert.notEqual(authRecord.passwordHash, baseInput.password);
    assert.equal(await bcrypt.compare(baseInput.password, authRecord.passwordHash), true);
  } finally {
    await cleanup();
  }
});

test("RegistrationService rejects duplicate email", async () => {
  const { DuplicateRegistrationError } = await import("../dist/services/registrationService.js");
  const registrationService = await createService();
  await cleanup();

  try {
    await registrationService.registerDriver(baseInput);

    await assert.rejects(
      () =>
        registrationService.registerDriver({
          ...baseInput,
          universityId: "REG002",
          licensePlate: "REG-002",
        }),
      (error) => error instanceof DuplicateRegistrationError && error.field === "email",
    );
  } finally {
    await cleanup();
  }
});

test("RegistrationService rejects duplicate university ID", async () => {
  const { DuplicateRegistrationError } = await import("../dist/services/registrationService.js");
  const registrationService = await createService();
  await cleanup();

  try {
    await registrationService.registerDriver(baseInput);

    await assert.rejects(
      () =>
        registrationService.registerDriver({
          ...baseInput,
          email: "duplicate-email@example.test",
          licensePlate: "REG-003",
        }),
      (error) => error instanceof DuplicateRegistrationError && error.field === "universityId",
    );
  } finally {
    await cleanup();
  }
});

test("RegistrationService rejects duplicate licence plate", async () => {
  const { DuplicateRegistrationError } = await import("../dist/services/registrationService.js");
  const registrationService = await createService();
  await cleanup();

  try {
    await registrationService.registerDriver(baseInput);

    await assert.rejects(
      () =>
        registrationService.registerDriver({
          ...baseInput,
          email: "duplicate-email@example.test",
          universityId: "REG003",
        }),
      (error) => error instanceof DuplicateRegistrationError && error.field === "licensePlate",
    );
  } finally {
    await cleanup();
  }
});

test("RegistrationService returns validation errors for missing required fields", async () => {
  const { RegistrationValidationError } = await import("../dist/services/registrationService.js");
  const registrationService = await createService();

  await assert.rejects(
    () =>
      registrationService.registerDriver({
        name: "",
        universityId: "",
        email: "not-an-email",
        password: "short",
        licensePlate: "",
      }),
    (error) => error instanceof RegistrationValidationError && error.issues.length >= 5,
  );
});

test.after(async () => {
  await prisma.$disconnect();
});
