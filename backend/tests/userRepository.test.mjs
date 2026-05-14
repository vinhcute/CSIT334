import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const testEmail = "repository-driver@example.test";
const testUniversityId = "REPO001";
const testLicensePlate = "REPO-001";

async function cleanup() {
  await prisma.user.deleteMany({
    where: {
      OR: [{ email: testEmail }, { universityId: testUniversityId }],
    },
  });
}

function assertNoPasswordHash(value) {
  assert.equal(Object.hasOwn(value, "passwordHash"), false);
}

test("UserRepository creates and reads safe user profiles", async (t) => {
  const { UserRepository } = await import("../dist/repositories/userRepository.js");
  const repository = new UserRepository(prisma);

  await cleanup();

  try {
    const created = await repository.createDriverWithVehicle({
      name: "Repository Test Driver",
      email: testEmail,
      universityId: testUniversityId,
      passwordHash: "repository-test-password-hash",
      licensePlate: testLicensePlate,
      vehicleMake: "Toyota",
      vehicleModel: "Corolla",
      vehicleColor: "White",
    });

    await t.test("createDriverWithVehicle creates a driver with one vehicle profile", () => {
      assert.equal(created.role, "driver");
      assert.equal(created.accountStatus, "active");
      assert.equal(created.vehicleProfiles.length, 1);
      assert.equal(created.vehicleProfiles[0].licensePlate, testLicensePlate);
      assertNoPasswordHash(created);
    });

    await t.test("findByEmail returns the safe user profile", async () => {
      const user = await repository.findByEmail(testEmail);

      assert.equal(user?.id, created.id);
      assert.equal(user?.email, testEmail);
      assertNoPasswordHash(user);
    });

    await t.test("findByUniversityId returns the safe user profile", async () => {
      const user = await repository.findByUniversityId(testUniversityId);

      assert.equal(user?.id, created.id);
      assert.equal(user?.universityId, testUniversityId);
      assertNoPasswordHash(user);
    });

    await t.test("findById returns the safe user profile", async () => {
      const user = await repository.findById(created.id);

      assert.equal(user?.id, created.id);
      assertNoPasswordHash(user);
    });

    await t.test("updateAccountStatus changes the user account status", async () => {
      const updated = await repository.updateAccountStatus(created.id, "disabled");

      assert.equal(updated.accountStatus, "disabled");
      assertNoPasswordHash(updated);
    });

    await t.test("findAuthRecordByEmail is the only lookup exposing passwordHash", async () => {
      const authRecord = await repository.findAuthRecordByEmail(testEmail);

      assert.equal(authRecord?.passwordHash, "repository-test-password-hash");
    });
  } finally {
    await cleanup();
  }
});

test.after(async () => {
  await prisma.$disconnect();
});
