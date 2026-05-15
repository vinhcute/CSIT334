import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const testZoneNames = [
  "Spot Service Zone A",
  "Spot Service Zone B",
];

async function cleanup() {
  await prisma.parkingZone.deleteMany({
    where: {
      name: { in: testZoneNames },
    },
  });
}

async function createZone(name, capacity = 10) {
  return prisma.parkingZone.create({
    data: {
      name,
      capacity,
    },
  });
}

async function createService() {
  const { ParkingSpotRepository } = await import("../dist/repositories/parkingSpotRepository.js");
  const { ParkingZoneRepository } = await import("../dist/repositories/parkingZoneRepository.js");
  const { ParkingSpotService } = await import("../dist/services/parkingSpotService.js");

  return new ParkingSpotService(
    new ParkingSpotRepository(prisma),
    new ParkingZoneRepository(prisma),
  );
}

test("ParkingSpotService creates a parking spot for an existing zone", async () => {
  const parkingSpotService = await createService();
  await cleanup();

  try {
    const zone = await createZone("Spot Service Zone A");
    const spot = await parkingSpotService.createSpot({
      zoneId: zone.id,
      spotCode: "A-001",
      status: "available",
      level: "L1",
      rowLabel: "A",
    });

    assert.equal(spot.zoneId, zone.id);
    assert.equal(spot.spotCode, "A-001");
    assert.equal(spot.status, "available");
    assert.equal(spot.level, "L1");
    assert.equal(spot.rowLabel, "A");
  } finally {
    await cleanup();
  }
});

test("ParkingSpotService rejects spots for missing zones", async () => {
  const {
    ParkingSpotZoneNotFoundError,
  } = await import("../dist/services/parkingSpotService.js");
  const parkingSpotService = await createService();

  await assert.rejects(
    () =>
      parkingSpotService.createSpot({
        zoneId: "missing-zone-id",
        spotCode: "A-001",
        status: "available",
      }),
    (error) => error instanceof ParkingSpotZoneNotFoundError,
  );
});

test("ParkingSpotService rejects blank spot codes and invalid statuses", async () => {
  const {
    ParkingSpotValidationError,
  } = await import("../dist/services/parkingSpotService.js");
  const parkingSpotService = await createService();
  await cleanup();

  try {
    const zone = await createZone("Spot Service Zone A");

    await assert.rejects(
      () =>
        parkingSpotService.createSpot({
          zoneId: zone.id,
          spotCode: "   ",
          status: "available",
        }),
      (error) =>
        error instanceof ParkingSpotValidationError &&
        error.issues.includes("Parking spot code is required."),
    );

    await assert.rejects(
      () =>
        parkingSpotService.createSpot({
          zoneId: zone.id,
          spotCode: "A-001",
          status: "blocked",
        }),
      (error) =>
        error instanceof ParkingSpotValidationError &&
        error.issues.includes("Parking spot status is invalid."),
    );
  } finally {
    await cleanup();
  }
});

test("ParkingSpotService rejects duplicate spot codes within the same zone", async () => {
  const {
    DuplicateParkingSpotCodeError,
  } = await import("../dist/services/parkingSpotService.js");
  const parkingSpotService = await createService();
  await cleanup();

  try {
    const zone = await createZone("Spot Service Zone A");
    await parkingSpotService.createSpot({
      zoneId: zone.id,
      spotCode: "A-001",
      status: "available",
    });

    await assert.rejects(
      () =>
        parkingSpotService.createSpot({
          zoneId: zone.id,
          spotCode: "A-001",
          status: "occupied",
        }),
      (error) => error instanceof DuplicateParkingSpotCodeError,
    );
  } finally {
    await cleanup();
  }
});

test("ParkingSpotService allows the same spot code in different zones", async () => {
  const parkingSpotService = await createService();
  await cleanup();

  try {
    const firstZone = await createZone("Spot Service Zone A");
    const secondZone = await createZone("Spot Service Zone B");
    const firstSpot = await parkingSpotService.createSpot({
      zoneId: firstZone.id,
      spotCode: "SHARED-001",
      status: "available",
    });
    const secondSpot = await parkingSpotService.createSpot({
      zoneId: secondZone.id,
      spotCode: "SHARED-001",
      status: "reserved",
    });

    assert.equal(firstSpot.spotCode, secondSpot.spotCode);
    assert.notEqual(firstSpot.zoneId, secondSpot.zoneId);
  } finally {
    await cleanup();
  }
});

test("ParkingSpotService updates spot status, level, and row label", async () => {
  const parkingSpotService = await createService();
  await cleanup();

  try {
    const zone = await createZone("Spot Service Zone A");
    const spot = await parkingSpotService.createSpot({
      zoneId: zone.id,
      spotCode: "A-001",
      status: "available",
      level: "L1",
      rowLabel: "A",
    });
    const updated = await parkingSpotService.updateSpot(spot.id, {
      status: "maintenanceRequired",
      level: "L2",
      rowLabel: "B",
    });

    assert.equal(updated.status, "maintenanceRequired");
    assert.equal(updated.level, "L2");
    assert.equal(updated.rowLabel, "B");
  } finally {
    await cleanup();
  }
});

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});
