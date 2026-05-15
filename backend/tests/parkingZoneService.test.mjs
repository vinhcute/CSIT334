import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const testZoneNames = [
  "Phase 3 North Zone",
  "Phase 3 Library Zone",
  "Phase 3 Engineering Zone",
  "Phase 3 Duplicate Zone",
];

async function cleanup() {
  await prisma.parkingZone.deleteMany({
    where: {
      name: { in: testZoneNames },
    },
  });
}

async function createService() {
  const { ParkingZoneRepository } = await import("../dist/repositories/parkingZoneRepository.js");
  const { ParkingZoneService } = await import("../dist/services/parkingZoneService.js");

  return new ParkingZoneService(new ParkingZoneRepository(prisma));
}

test("ParkingZoneService creates parking zones with display fields", async () => {
  const parkingZoneService = await createService();
  await cleanup();

  try {
    const zone = await parkingZoneService.createZone({
      name: "Phase 3 North Zone",
      description: "North campus parking.",
      capacity: 24,
      distanceFromEntryMeters: 120,
      displayOrder: 2,
    });

    assert.equal(zone.name, "Phase 3 North Zone");
    assert.equal(zone.description, "North campus parking.");
    assert.equal(zone.capacity, 24);
    assert.equal(zone.distanceFromEntryMeters, 120);
    assert.equal(zone.displayOrder, 2);
  } finally {
    await cleanup();
  }
});

test("ParkingZoneService lists zones by display order and then name", async () => {
  const parkingZoneService = await createService();
  await cleanup();

  try {
    await parkingZoneService.createZone({
      name: "Phase 3 North Zone",
      capacity: 10,
      displayOrder: 2,
    });
    await parkingZoneService.createZone({
      name: "Phase 3 Library Zone",
      capacity: 10,
      displayOrder: 1,
    });
    await parkingZoneService.createZone({
      name: "Phase 3 Engineering Zone",
      capacity: 10,
      displayOrder: 1,
    });

    const zones = await parkingZoneService.listZones();
    const phaseThreeZones = zones.filter((zone) => testZoneNames.includes(zone.name));

    assert.deepEqual(
      phaseThreeZones.map((zone) => zone.name),
      ["Phase 3 Engineering Zone", "Phase 3 Library Zone", "Phase 3 North Zone"],
    );
  } finally {
    await cleanup();
  }
});

test("ParkingZoneService updates parking zone display fields", async () => {
  const parkingZoneService = await createService();
  await cleanup();

  try {
    const zone = await parkingZoneService.createZone({
      name: "Phase 3 North Zone",
      description: "Original description.",
      capacity: 12,
      distanceFromEntryMeters: 90,
      displayOrder: 1,
    });
    const updated = await parkingZoneService.updateZone(zone.id, {
      description: "Updated description.",
      capacity: 18,
      distanceFromEntryMeters: 150,
      displayOrder: 4,
    });

    assert.equal(updated.description, "Updated description.");
    assert.equal(updated.capacity, 18);
    assert.equal(updated.distanceFromEntryMeters, 150);
    assert.equal(updated.displayOrder, 4);
  } finally {
    await cleanup();
  }
});

test("ParkingZoneService rejects blank names and invalid capacity", async () => {
  const {
    ParkingZoneValidationError,
  } = await import("../dist/services/parkingZoneService.js");
  const parkingZoneService = await createService();

  await assert.rejects(
    () =>
      parkingZoneService.createZone({
        name: "   ",
        capacity: 10,
      }),
    (error) => error instanceof ParkingZoneValidationError && error.issues.includes("Parking zone name is required."),
  );

  await assert.rejects(
    () =>
      parkingZoneService.createZone({
        name: "Phase 3 North Zone",
        capacity: 0,
      }),
    (error) => error instanceof ParkingZoneValidationError && error.issues.includes("Capacity must be at least 1."),
  );
});

test("ParkingZoneService returns a controlled duplicate name error", async () => {
  const {
    DuplicateParkingZoneNameError,
  } = await import("../dist/services/parkingZoneService.js");
  const parkingZoneService = await createService();
  await cleanup();

  try {
    await parkingZoneService.createZone({
      name: "Phase 3 Duplicate Zone",
      capacity: 10,
    });

    await assert.rejects(
      () =>
        parkingZoneService.createZone({
          name: "Phase 3 Duplicate Zone",
          capacity: 20,
        }),
      (error) => error instanceof DuplicateParkingZoneNameError,
    );
  } finally {
    await cleanup();
  }
});

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});
