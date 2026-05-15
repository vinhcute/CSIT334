import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const testZoneNames = [
  "Detection Service Zone A",
  "Detection Service Zone B",
  "Detection Service Reserved Zone",
];

async function cleanup() {
  await prisma.parkingZone.deleteMany({
    where: {
      name: { in: testZoneNames },
    },
  });
}

async function createSpot({ zoneName = "Detection Service Zone A", status = "available" } = {}) {
  const zone = await prisma.parkingZone.create({
    data: {
      name: zoneName,
      capacity: 4,
    },
  });

  return prisma.parkingSpot.create({
    data: {
      zoneId: zone.id,
      spotCode: `${zoneName.slice(-6).trim() || "SPOT"}-001`,
      status,
    },
  });
}

async function createService() {
  const { DetectionEventRepository } = await import("../dist/repositories/detectionEventRepository.js");
  const { ParkingSpotRepository } = await import("../dist/repositories/parkingSpotRepository.js");
  const { DetectionEventService } = await import("../dist/services/detectionEventService.js");

  return new DetectionEventService(
    new DetectionEventRepository(prisma),
    new ParkingSpotRepository(prisma),
  );
}

test("DetectionEventService records vehicleEntry events and marks available spots occupied", async () => {
  const detectionEventService = await createService();
  await cleanup();

  try {
    const spot = await createSpot();
    const occurredAt = new Date("2026-05-15T01:30:00.000Z");
    const result = await detectionEventService.ingestDetectionEvent({
      spotId: spot.id,
      type: "vehicleEntry",
      occurredAt,
      rawPayload: {
        source: "simulator",
        confidence: 0.97,
        camera: { id: "CAM-A1", frame: 42 },
      },
    });
    const updatedSpot = await prisma.parkingSpot.findUniqueOrThrow({
      where: { id: spot.id },
    });

    assert.equal(result.detectionEvent.spotId, spot.id);
    assert.equal(result.detectionEvent.type, "vehicleEntry");
    assert.equal(result.detectionEvent.occurredAt.toISOString(), occurredAt.toISOString());
    assert.deepEqual(result.detectionEvent.rawPayload, {
      source: "simulator",
      confidence: 0.97,
      camera: { id: "CAM-A1", frame: 42 },
    });
    assert.equal(result.parkingSpot.status, "occupied");
    assert.equal(updatedSpot.status, "occupied");
  } finally {
    await cleanup();
  }
});

test("DetectionEventService records vehicleExit events and marks occupied spots available", async () => {
  const detectionEventService = await createService();
  await cleanup();

  try {
    const spot = await createSpot({ status: "occupied" });
    const result = await detectionEventService.ingestDetectionEvent({
      spotId: spot.id,
      type: "vehicleExit",
      rawPayload: {
        source: "simulator",
        plateDetected: false,
      },
    });
    const updatedSpot = await prisma.parkingSpot.findUniqueOrThrow({
      where: { id: spot.id },
    });

    assert.equal(result.detectionEvent.type, "vehicleExit");
    assert.equal(result.parkingSpot.status, "available");
    assert.equal(updatedSpot.status, "available");
  } finally {
    await cleanup();
  }
});

test("DetectionEventService returns a controlled not-found error for missing spots", async () => {
  const {
    DetectionEventSpotNotFoundError,
  } = await import("../dist/services/detectionEventService.js");
  const detectionEventService = await createService();

  await assert.rejects(
    () =>
      detectionEventService.ingestDetectionEvent({
        spotId: "missing-spot-id",
        type: "vehicleEntry",
      }),
    (error) => error instanceof DetectionEventSpotNotFoundError,
  );
});

test("DetectionEventService rejects detection events for reserved spots", async () => {
  const {
    DetectionEventReservedSpotConflictError,
  } = await import("../dist/services/detectionEventService.js");
  const detectionEventService = await createService();
  await cleanup();

  try {
    const spot = await createSpot({
      zoneName: "Detection Service Reserved Zone",
      status: "reserved",
    });

    await assert.rejects(
      () =>
        detectionEventService.ingestDetectionEvent({
          spotId: spot.id,
          type: "vehicleExit",
        }),
      (error) => error instanceof DetectionEventReservedSpotConflictError,
    );

    const unchangedSpot = await prisma.parkingSpot.findUniqueOrThrow({
      where: { id: spot.id },
    });
    const eventCount = await prisma.detectionEvent.count({
      where: { spotId: spot.id },
    });

    assert.equal(unchangedSpot.status, "reserved");
    assert.equal(eventCount, 0);
  } finally {
    await cleanup();
  }
});

test("DetectionEventService returns validation errors for invalid input", async () => {
  const {
    DetectionEventValidationError,
  } = await import("../dist/services/detectionEventService.js");
  const detectionEventService = await createService();

  await assert.rejects(
    () =>
      detectionEventService.ingestDetectionEvent({
        spotId: "   ",
        type: "vehicleEntry",
      }),
    (error) =>
      error instanceof DetectionEventValidationError &&
      error.issues.includes("Parking spot ID is required."),
  );

  await assert.rejects(
    () =>
      detectionEventService.ingestDetectionEvent({
        spotId: "spot-id",
        type: "pedestrianDetected",
      }),
    (error) =>
      error instanceof DetectionEventValidationError &&
      error.issues.includes("Detection event type is invalid."),
  );
});

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});
