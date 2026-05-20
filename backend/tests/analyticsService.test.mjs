import assert from "node:assert/strict";
import test from "node:test";
import { SpotStatus } from "@prisma/client";

function decimal(value) {
  return {
    toString: () => String(value),
  };
}

function historyRecord({
  zoneId = "zone-a",
  zoneName = "North Zone",
  recordedAt,
  capacity = 10,
  availableSpots = 4,
  occupiedSpots = 5,
  reservedSpots = 1,
  occupancyRate = 60,
}) {
  return {
    id: `${zoneId}-${recordedAt.toISOString()}`,
    zoneId,
    recordedAt,
    capacity,
    availableSpots,
    occupiedSpots,
    reservedSpots,
    occupancyRate: decimal(occupancyRate),
    zone: {
      id: zoneId,
      name: zoneName,
    },
  };
}

function createRepository({ history = [], zones = [] } = {}) {
  const calls = {
    historyStarts: [],
    zoneReads: 0,
  };

  return {
    calls,
    async listOccupancyHistorySince(start) {
      calls.historyStarts.push(start);
      return history.filter((record) => record.recordedAt >= start);
    },
    async listZonesWithSpots() {
      calls.zoneReads += 1;
      return zones;
    },
  };
}

test("AnalyticsService maps occupancy history into trend points for supported ranges", async () => {
  const { AnalyticsService } = await import("../dist/services/analyticsService.js");
  const now = new Date("2026-05-20T10:30:00");
  const inRange = historyRecord({
    recordedAt: new Date("2026-05-20T09:00:00"),
    occupancyRate: 72.5,
  });
  const outOfRange = historyRecord({
    recordedAt: new Date("2026-05-19T23:59:59"),
    occupancyRate: 99,
  });
  const repository = createRepository({ history: [outOfRange, inRange] });
  const service = new AnalyticsService(repository);

  const trends = await service.getOccupancyTrends("today", now);

  assert.equal(repository.calls.historyStarts[0].getHours(), 0);
  assert.equal(repository.calls.historyStarts[0].getMinutes(), 0);
  assert.deepEqual(trends, [
    {
      recordedAt: inRange.recordedAt,
      zoneId: "zone-a",
      zoneName: "North Zone",
      capacity: 10,
      availableSpots: 4,
      occupiedSpots: 5,
      reservedSpots: 1,
      occupancyRate: 72.5,
    },
  ]);
});

test("AnalyticsService rejects unsupported analytics ranges", async () => {
  const { AnalyticsService, AnalyticsValidationError } = await import(
    "../dist/services/analyticsService.js"
  );
  const service = new AnalyticsService(createRepository());

  await assert.rejects(
    () => service.getOccupancyTrends("year"),
    (error) =>
      error instanceof AnalyticsValidationError &&
      error.issues.includes("Range must be one of: today, week, month."),
  );
});

test("AnalyticsService summarises peak hours by average occupancy", async () => {
  const { AnalyticsService } = await import("../dist/services/analyticsService.js");
  const repository = createRepository({
    history: [
      historyRecord({ recordedAt: new Date("2026-05-20T08:00:00"), occupancyRate: 70 }),
      historyRecord({ recordedAt: new Date("2026-05-20T08:30:00"), occupancyRate: 90 }),
      historyRecord({ recordedAt: new Date("2026-05-20T14:00:00"), occupancyRate: 75 }),
      historyRecord({ recordedAt: new Date("2026-05-20T00:00:00"), occupancyRate: 40 }),
    ],
  });
  const service = new AnalyticsService(repository);

  const peakHours = await service.getPeakHours("today", new Date("2026-05-20T15:00:00"));

  assert.deepEqual(peakHours.slice(0, 3), [
    { hour: 8, hourLabel: "8 AM", averageOccupancyRate: 80, sampleCount: 2 },
    { hour: 14, hourLabel: "2 PM", averageOccupancyRate: 75, sampleCount: 1 },
    { hour: 0, hourLabel: "12 AM", averageOccupancyRate: 40, sampleCount: 1 },
  ]);
});

test("AnalyticsService calculates current zone utilisation with reserved and maintenance rules", async () => {
  const { AnalyticsService } = await import("../dist/services/analyticsService.js");
  const repository = createRepository({
    zones: [
      {
        id: "zone-a",
        name: "North Zone",
        capacity: 5,
        displayOrder: 1,
        parkingSpots: [
          { id: "spot-1", status: SpotStatus.available },
          { id: "spot-2", status: SpotStatus.occupied },
          { id: "spot-3", status: SpotStatus.reserved },
          { id: "spot-4", status: SpotStatus.maintenanceRequired },
        ],
      },
    ],
  });
  const service = new AnalyticsService(repository);

  const utilisation = await service.getZoneUtilisation();

  assert.deepEqual(utilisation, [
    {
      zoneId: "zone-a",
      zoneName: "North Zone",
      capacity: 5,
      availableSpots: 1,
      occupiedSpots: 1,
      reservedSpots: 1,
      maintenanceRequiredSpots: 1,
      utilisationRate: 40,
    },
  ]);
});

test("AnalyticsService builds summary totals with incident placeholder", async () => {
  const { AnalyticsService } = await import("../dist/services/analyticsService.js");
  const repository = createRepository({
    history: [
      historyRecord({ recordedAt: new Date("2026-05-20T08:00:00"), occupancyRate: 70 }),
    ],
    zones: [
      {
        id: "zone-a",
        name: "North Zone",
        capacity: 4,
        displayOrder: 1,
        parkingSpots: [
          { id: "spot-1", status: SpotStatus.available },
          { id: "spot-2", status: SpotStatus.occupied },
          { id: "spot-3", status: SpotStatus.reserved },
          { id: "spot-4", status: SpotStatus.maintenanceRequired },
        ],
      },
    ],
  });
  const now = new Date("2026-05-20T10:00:00");
  const service = new AnalyticsService(repository);

  const summary = await service.getSummary("today", now);

  assert.equal(summary.range, "today");
  assert.equal(summary.generatedAt, now);
  assert.equal(summary.totalCapacity, 4);
  assert.equal(summary.totalAvailableSpots, 1);
  assert.equal(summary.totalOccupiedSpots, 1);
  assert.equal(summary.totalReservedSpots, 1);
  assert.equal(summary.totalMaintenanceRequiredSpots, 1);
  assert.equal(summary.averageOccupancyRate, 50);
  assert.equal(summary.openIncidentCount, null);
  assert.equal(summary.occupancyTrends.length, 1);
  assert.equal(summary.peakHours.length, 1);
  assert.equal(summary.zoneUtilisation.length, 1);
});
