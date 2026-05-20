import assert from "node:assert/strict";
import test from "node:test";

async function loadPredictionDomain() {
  return import("../dist/services/predictiveAvailabilityService.js");
}

async function createService({ history = [], zone = createZone() } = {}) {
  const { PredictiveAvailabilityService } = await loadPredictionDomain();

  return new PredictiveAvailabilityService({
    async findZoneWithCurrentSpots(zoneId) {
      return zone && zone.id === zoneId ? zone : null;
    },
    async listRecentHistory() {
      return history;
    },
  });
}

function createZone(overrides = {}) {
  const statuses = overrides.statuses ?? [
    "available",
    "available",
    "occupied",
    "reserved",
    "maintenanceRequired",
  ];

  return {
    id: overrides.id ?? "zone-a",
    name: overrides.name ?? "Zone A",
    capacity: overrides.capacity ?? 5,
    parkingSpots: statuses.map((status) => ({ status })),
  };
}

function historySample(recordedAt, overrides = {}) {
  return {
    id: overrides.id ?? `history-${recordedAt}`,
    zoneId: overrides.zoneId ?? "zone-a",
    recordedAt: new Date(recordedAt),
    capacity: overrides.capacity ?? 10,
    availableSpots: overrides.availableSpots ?? 4,
    occupiedSpots: overrides.occupiedSpots ?? 5,
    reservedSpots: overrides.reservedSpots ?? 1,
    occupancyRate: {
      toString: () => String(overrides.occupancyRate ?? "60.00"),
    },
  };
}

test("PredictiveAvailabilityService validates zone and future target time", async () => {
  const {
    PredictiveAvailabilityValidationError,
  } = await loadPredictionDomain();
  const service = await createService();
  const now = new Date("2026-05-20T04:00:00.000Z");

  await assert.rejects(
    () =>
      service.predictAvailability(
        { zoneId: "", targetTime: new Date("2026-05-20T05:00:00.000Z") },
        now,
      ),
    (error) =>
      error instanceof PredictiveAvailabilityValidationError &&
      error.issues.includes("Parking zone ID is required."),
  );

  await assert.rejects(
    () =>
      service.predictAvailability(
        { zoneId: "zone-a", targetTime: new Date("2026-05-20T04:00:00.000Z") },
        now,
      ),
    (error) =>
      error instanceof PredictiveAvailabilityValidationError &&
      error.issues.includes("Target time must be in the future."),
  );
});

test("PredictiveAvailabilityService returns controlled not-found errors", async () => {
  const {
    PredictiveAvailabilityZoneNotFoundError,
  } = await loadPredictionDomain();
  const service = await createService({ zone: null });

  await assert.rejects(
    () =>
      service.predictAvailability(
        { zoneId: "missing-zone", targetTime: new Date("2026-05-21T04:00:00.000Z") },
        new Date("2026-05-20T04:00:00.000Z"),
      ),
    (error) => error instanceof PredictiveAvailabilityZoneNotFoundError,
  );
});

test("PredictiveAvailabilityService uses same weekday and hour history when samples are sufficient", async () => {
  const service = await createService({
    history: [
      historySample("2026-05-14T09:15:00.000Z", {
        availableSpots: 4,
        occupancyRate: "60.00",
      }),
      historySample("2026-05-07T09:45:00.000Z", {
        availableSpots: 6,
        occupancyRate: "40.00",
      }),
      historySample("2026-04-30T09:00:00.000Z", {
        availableSpots: 5,
        occupancyRate: "50.00",
      }),
      historySample("2026-05-14T08:00:00.000Z", {
        availableSpots: 1,
        occupancyRate: "90.00",
      }),
    ],
    zone: createZone({ capacity: 10 }),
  });

  const result = await service.predictAvailability(
    { zoneId: "zone-a", targetTime: new Date("2026-05-21T09:30:00.000Z") },
    new Date("2026-05-20T04:00:00.000Z"),
  );

  assert.equal(result.zoneId, "zone-a");
  assert.equal(result.zoneName, "Zone A");
  assert.equal(result.predictedAvailableSpots, 5);
  assert.equal(result.predictedOccupancyRate, 50);
  assert.equal(result.availabilityProbability, 50);
  assert.equal(result.confidenceLabel, "medium");
  assert.equal(result.historicalSampleCount, 3);
  assert.match(result.basis, /3 historical samples/);
});

test("PredictiveAvailabilityService falls back to current occupancy when history is sparse", async () => {
  const service = await createService({
    history: [
      historySample("2026-05-14T09:15:00.000Z", {
        availableSpots: 0,
        occupancyRate: "100.00",
      }),
    ],
    zone: createZone({
      capacity: 5,
      statuses: ["available", "available", "occupied", "reserved", "maintenanceRequired"],
    }),
  });

  const result = await service.predictAvailability(
    { zoneId: "zone-a", targetTime: new Date("2026-05-21T09:30:00.000Z") },
    new Date("2026-05-20T04:00:00.000Z"),
  );

  assert.equal(result.predictedAvailableSpots, 2);
  assert.equal(result.predictedOccupancyRate, 40);
  assert.equal(result.availabilityProbability, 40);
  assert.equal(result.confidenceLabel, "low");
  assert.equal(result.historicalSampleCount, 1);
  assert.match(result.basis, /current spot status/);
});

test("PredictiveAvailabilityService clamps historical results within valid bounds", async () => {
  const service = await createService({
    history: [
      historySample("2026-05-14T09:00:00.000Z", {
        availableSpots: 50,
        occupancyRate: "140.00",
      }),
      historySample("2026-05-07T09:00:00.000Z", {
        availableSpots: 30,
        occupancyRate: "120.00",
      }),
      historySample("2026-04-30T09:00:00.000Z", {
        availableSpots: 40,
        occupancyRate: "130.00",
      }),
    ],
    zone: createZone({ capacity: 10 }),
  });

  const result = await service.predictAvailability(
    { zoneId: "zone-a", targetTime: new Date("2026-05-21T09:30:00.000Z") },
    new Date("2026-05-20T04:00:00.000Z"),
  );

  assert.equal(result.predictedAvailableSpots, 10);
  assert.equal(result.predictedOccupancyRate, 100);
  assert.equal(result.availabilityProbability, 100);
});
