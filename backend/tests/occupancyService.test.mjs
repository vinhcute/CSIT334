import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const testZoneNames = [
  "Occupancy Service Zone A",
  "Occupancy Service Zone B",
];

async function cleanup() {
  await prisma.parkingZone.deleteMany({
    where: {
      name: { in: testZoneNames },
    },
  });
}

async function createService() {
  const { OccupancyRepository } = await import("../dist/repositories/occupancyRepository.js");
  const { OccupancyService } = await import("../dist/services/occupancyService.js");

  return new OccupancyService(new OccupancyRepository(prisma));
}

async function createZoneWithSpots() {
  return prisma.parkingZone.create({
    data: {
      name: "Occupancy Service Zone A",
      capacity: 8,
      parkingSpots: {
        create: [
          { spotCode: "A-001", status: "available", level: "L1", rowLabel: "A" },
          { spotCode: "A-002", status: "available", level: "L1", rowLabel: "A" },
          { spotCode: "A-003", status: "occupied", level: "L1", rowLabel: "A" },
          { spotCode: "A-004", status: "reserved", level: "L1", rowLabel: "A" },
          {
            spotCode: "A-005",
            status: "maintenanceRequired",
            level: "L1",
            rowLabel: "A",
          },
        ],
      },
    },
  });
}

test("OccupancyService calculates zone counts from current spot statuses", async () => {
  const occupancyService = await createService();
  await cleanup();

  try {
    const zone = await createZoneWithSpots();
    const summary = await occupancyService.getSummary();
    const zoneSummary = summary.zones.find((candidate) => candidate.zoneId === zone.id);

    assert.ok(zoneSummary);
    assert.equal(zoneSummary.capacity, 8);
    assert.equal(zoneSummary.availableSpots, 2);
    assert.equal(zoneSummary.occupiedSpots, 1);
    assert.equal(zoneSummary.reservedSpots, 1);
    assert.equal(zoneSummary.maintenanceRequiredSpots, 1);
    assert.equal(zoneSummary.occupancyRate, "25.00");
    assert.equal(summary.totalCapacity >= 8, true);
    assert.equal(summary.totalAvailableSpots >= 2, true);
  } finally {
    await cleanup();
  }
});

test("OccupancyService excludes maintenance spots from available and occupied counts", async () => {
  const occupancyService = await createService();
  await cleanup();

  try {
    const zone = await createZoneWithSpots();
    const detail = await occupancyService.getZoneDetail(zone.id);

    assert.equal(detail.availableSpots, 2);
    assert.equal(detail.occupiedSpots, 1);
    assert.equal(detail.reservedSpots, 1);
    assert.equal(detail.maintenanceRequiredSpots, 1);
    assert.equal(detail.spots.some((spot) => spot.statusText === "Maintenance required"), true);
  } finally {
    await cleanup();
  }
});

test("OccupancyService records history with the current calculated counts", async () => {
  const occupancyService = await createService();
  await cleanup();

  try {
    const zone = await createZoneWithSpots();
    const recordedAt = new Date("2026-05-15T04:00:00.000Z");
    const history = await occupancyService.recordZoneHistory(zone.id, recordedAt);

    assert.equal(history.zoneId, zone.id);
    assert.equal(history.recordedAt.toISOString(), recordedAt.toISOString());
    assert.equal(history.capacity, 8);
    assert.equal(history.availableSpots, 2);
    assert.equal(history.occupiedSpots, 1);
    assert.equal(history.reservedSpots, 1);
    assert.equal(history.occupancyRate.toString(), "25");
  } finally {
    await cleanup();
  }
});

test("OccupancyService returns a controlled error for missing zones", async () => {
  const {
    OccupancyZoneNotFoundError,
  } = await import("../dist/services/occupancyService.js");
  const occupancyService = await createService();

  await assert.rejects(
    () => occupancyService.getZoneDetail("missing-zone-id"),
    (error) => error instanceof OccupancyZoneNotFoundError,
  );

  await assert.rejects(
    () => occupancyService.recordZoneHistory("missing-zone-id"),
    (error) => error instanceof OccupancyZoneNotFoundError,
  );
});

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});
