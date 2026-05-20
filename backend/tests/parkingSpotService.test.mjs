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
      zoneCode: zoneCodeForName(name),
      name,
      capacity,
    },
  });
}

function zoneCodeForName(name) {
  return name.endsWith("Zone B") ? "PSB" : "PSA";
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

test("ParkingSpotService generates the next padded spot code without reusing gaps", async () => {
  const parkingSpotService = await createService();
  await cleanup();

  try {
    const zone = await createZone("Spot Service Zone A");
    await prisma.parkingSpot.createMany({
      data: [
        { zoneId: zone.id, spotCode: "PSA-001", status: "available" },
        { zoneId: zone.id, spotCode: "PSA-003", status: "available" },
        { zoneId: zone.id, spotCode: "OTHER-200", status: "available" },
      ],
    });

    assert.equal(await parkingSpotService.getNextSpotCodeForZone(zone.id), "PSA-004");
    const created = await parkingSpotService.createSpot({
      zoneId: zone.id,
      status: "available",
    });

    assert.equal(created.spotCode, "PSA-004");
  } finally {
    await cleanup();
  }
});

test("ParkingSpotService bulk updates level for all spots in a zone", async () => {
  const parkingSpotService = await createService();
  await cleanup();

  try {
    const zone = await createZone("Spot Service Zone A");
    await parkingSpotService.createSpot({
      zoneId: zone.id,
      spotCode: "A-001",
      status: "available",
    });
    await parkingSpotService.createSpot({
      zoneId: zone.id,
      spotCode: "A-002",
      status: "occupied",
    });

    const result = await parkingSpotService.bulkUpdateSpotLevel({
      zoneId: zone.id,
      level: "Level 2",
    });

    assert.equal(result.updatedCount, 2);
    const updatedSpots = await prisma.parkingSpot.findMany({ where: { zoneId: zone.id } });
    assert.equal(updatedSpots.every((spot) => spot.level === "Level 2"), true);
    assert.equal(updatedSpots.some((spot) => spot.status !== "available"), true);
  } finally {
    await cleanup();
  }
});

test("ParkingSpotService bulk updates selected spot IDs only", async () => {
  const parkingSpotService = await createService();
  await cleanup();

  try {
    const zone = await createZone("Spot Service Zone A");
    const spotOne = await parkingSpotService.createSpot({
      zoneId: zone.id,
      spotCode: "A-001",
      status: "available",
    });
    const spotTwo = await parkingSpotService.createSpot({
      zoneId: zone.id,
      spotCode: "A-002",
      status: "available",
    });

    const result = await parkingSpotService.bulkUpdateSpotLevel({
      zoneId: zone.id,
      level: "Ground",
      spotIds: [spotOne.id],
    });

    assert.equal(result.updatedCount, 1);
    const reloadedOne = await prisma.parkingSpot.findUnique({ where: { id: spotOne.id } });
    const reloadedTwo = await prisma.parkingSpot.findUnique({ where: { id: spotTwo.id } });
    assert.equal(reloadedOne.level, "Ground");
    assert.equal(reloadedTwo.level, null);
  } finally {
    await cleanup();
  }
});

test("ParkingSpotService rejects blank level and missing zones for bulk level updates", async () => {
  const {
    ParkingSpotValidationError,
    ParkingSpotZoneNotFoundError,
  } = await import("../dist/services/parkingSpotService.js");
  const parkingSpotService = await createService();

  await assert.rejects(
    () =>
      parkingSpotService.bulkUpdateSpotLevel({
        zoneId: "zone-1",
        level: "   ",
      }),
    (error) =>
      error instanceof ParkingSpotValidationError && error.issues.includes("Level is required."),
  );

  await assert.rejects(
    () =>
      parkingSpotService.bulkUpdateSpotLevel({
        zoneId: "missing-zone-id",
        level: "Level 1",
      }),
    (error) => error instanceof ParkingSpotZoneNotFoundError,
  );

  await assert.rejects(
    () =>
      parkingSpotService.bulkUpdateSpotLevel({
        zoneId: "zone-1",
        level: "Level 1",
        range: {
          from: 10,
          to: 1,
        },
      }),
    (error) =>
      error instanceof ParkingSpotValidationError &&
      error.issues.includes("Range start must be less than or equal to range end."),
  );

  await assert.rejects(
    () =>
      parkingSpotService.bulkUpdateSpotLevel({
        zoneId: "zone-1",
        level: "Level 1",
        range: {
          from: 0,
          to: 1,
        },
      }),
    (error) =>
      error instanceof ParkingSpotValidationError &&
      error.issues.includes("Range start must be at least 1."),
  );

  await assert.rejects(
    () =>
      parkingSpotService.bulkUpdateSpotLevel({
        zoneId: "zone-1",
        level: "Level 1",
        range: {
          from: 1.5,
          to: 3,
        },
      }),
    (error) =>
      error instanceof ParkingSpotValidationError &&
      error.issues.includes("Range start must be a whole number."),
  );
});

test("ParkingSpotService rejects selected spot IDs outside the chosen zone", async () => {
  const { ParkingSpotValidationError } = await import("../dist/services/parkingSpotService.js");
  const parkingSpotService = await createService();
  await cleanup();

  try {
    const firstZone = await createZone("Spot Service Zone A");
    const secondZone = await createZone("Spot Service Zone B");
    const secondZoneSpot = await parkingSpotService.createSpot({
      zoneId: secondZone.id,
      spotCode: "B-001",
      status: "available",
    });

    await assert.rejects(
      () =>
        parkingSpotService.bulkUpdateSpotLevel({
          zoneId: firstZone.id,
          level: "Level 1",
          spotIds: [secondZoneSpot.id],
        }),
      (error) =>
        error instanceof ParkingSpotValidationError &&
        error.issues.includes("All selected spots must belong to the selected zone."),
    );
  } finally {
    await cleanup();
  }
});

test("ParkingSpotService bulk updates only spots in a complete range", async () => {
  const parkingSpotService = await createService();
  await cleanup();

  try {
    const zone = await createZone("Spot Service Zone A");
    const otherZone = await createZone("Spot Service Zone B");
    await prisma.parkingSpot.createMany({
      data: [
        { zoneId: zone.id, spotCode: "PSA-001", status: "available", level: null },
        { zoneId: zone.id, spotCode: "PSA-002", status: "reserved", level: null },
        { zoneId: zone.id, spotCode: "PSA-003", status: "occupied", level: "Ground" },
        { zoneId: zone.id, spotCode: "CUSTOM-X", status: "available", level: "Outdoor" },
        { zoneId: otherZone.id, spotCode: "PSB-001", status: "available", level: null },
      ],
    });

    const result = await parkingSpotService.bulkUpdateSpotLevel({
      zoneId: zone.id,
      level: "Level 2",
      range: { from: 1, to: 3 },
    });

    assert.equal(result.updatedCount, 3);
    assert.equal(result.mode, "range");
    const zoneSpots = await prisma.parkingSpot.findMany({ where: { zoneId: zone.id } });
    const rangeSpots = zoneSpots.filter((spot) => ["PSA-001", "PSA-002", "PSA-003"].includes(spot.spotCode));
    assert.equal(rangeSpots.every((spot) => spot.level === "Level 2"), true);
    assert.equal(rangeSpots.some((spot) => spot.status === "reserved"), true);
    assert.equal(rangeSpots.some((spot) => spot.status === "occupied"), true);
    const customSpot = zoneSpots.find((spot) => spot.spotCode === "CUSTOM-X");
    assert.equal(customSpot.level, "Outdoor");
  } finally {
    await cleanup();
  }
});

test("ParkingSpotService rejects range updates when expected spot codes are missing with no partial updates", async () => {
  const { ParkingSpotRangeConflictError } = await import("../dist/services/parkingSpotService.js");
  const parkingSpotService = await createService();
  await cleanup();

  try {
    const zone = await createZone("Spot Service Zone A");
    await prisma.parkingSpot.createMany({
      data: [
        { zoneId: zone.id, spotCode: "PSA-001", status: "available", level: "Ground" },
        { zoneId: zone.id, spotCode: "PSA-003", status: "available", level: "Ground" },
      ],
    });

    await assert.rejects(
      () =>
        parkingSpotService.bulkUpdateSpotLevel({
          zoneId: zone.id,
          level: "Level 1",
          range: { from: 1, to: 3 },
        }),
      (error) =>
        error instanceof ParkingSpotRangeConflictError &&
        error.message.includes("PSA-002"),
    );

    const spots = await prisma.parkingSpot.findMany({ where: { zoneId: zone.id } });
    assert.equal(spots.every((spot) => spot.level === "Ground"), true);
  } finally {
    await cleanup();
  }
});

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});
