import assert from "node:assert/strict";
import test from "node:test";

async function createService(zones) {
  const { RecommendationService } = await import("../dist/services/recommendationService.js");

  return new RecommendationService({
    async listZonesWithSpots() {
      return zones;
    },
  });
}

function zone(input) {
  return {
    id: input.id,
    name: input.name,
    capacity: input.capacity ?? input.statuses.length,
    distanceFromEntryMeters: input.distanceFromEntryMeters ?? null,
    displayOrder: input.displayOrder ?? 0,
    parkingSpots: input.statuses.map((status) => ({ status })),
  };
}

test("RecommendationService picks nearest available zone deterministically", async () => {
  const service = await createService([
    zone({
      id: "unknown-distance",
      name: "Unknown Distance",
      statuses: ["available"],
      distanceFromEntryMeters: null,
    }),
    zone({
      id: "far-zone",
      name: "Far Zone",
      statuses: ["available", "occupied"],
      distanceFromEntryMeters: 400,
      displayOrder: 1,
    }),
    zone({
      id: "near-zone",
      name: "Near Zone",
      statuses: ["available", "reserved"],
      distanceFromEntryMeters: 120,
      displayOrder: 3,
    }),
    zone({
      id: "near-zone-priority",
      name: "Near Zone Priority",
      statuses: ["available", "reserved"],
      distanceFromEntryMeters: 120,
      displayOrder: 2,
    }),
    zone({
      id: "full-zone",
      name: "Full Zone",
      statuses: ["occupied", "reserved", "maintenanceRequired"],
      distanceFromEntryMeters: 20,
    }),
  ]);

  const recommendation = await service.getNearestAvailableZone();

  assert.equal(recommendation.type, "nearestAvailableZone");
  assert.equal(recommendation.zoneId, "near-zone-priority");
  assert.equal(recommendation.zoneName, "Near Zone Priority");
  assert.equal(recommendation.distanceFromEntryMeters, 120);
  assert.equal(recommendation.displayOrder, 2);
  assert.equal(recommendation.availableSpots, 1);
  assert.equal(recommendation.reservedSpots, 1);
  assert.equal(recommendation.occupancyRate, 50);
});

test("RecommendationService picks least congested zone with documented tie-breakers", async () => {
  const service = await createService([
    zone({
      id: "library",
      name: "Library Zone",
      capacity: 8,
      statuses: ["available", "available", "available", "occupied"],
      distanceFromEntryMeters: 220,
    }),
    zone({
      id: "engineering",
      name: "Engineering Zone",
      capacity: 8,
      statuses: ["available", "available", "occupied", "maintenanceRequired"],
      distanceFromEntryMeters: 180,
    }),
    zone({
      id: "sports",
      name: "Sports Zone",
      capacity: 8,
      statuses: ["available", "reserved", "maintenanceRequired"],
      distanceFromEntryMeters: 80,
    }),
  ]);

  const recommendation = await service.getLeastCongestedZone();

  assert.equal(recommendation.zoneId, "library");
  assert.equal(recommendation.availableSpots, 3);
  assert.equal(recommendation.occupiedSpots, 1);
  assert.equal(recommendation.reservedSpots, 0);
  assert.equal(recommendation.maintenanceRequiredSpots, 0);
  assert.equal(recommendation.occupancyRate, 12.5);
});

test("RecommendationService counts reserved as occupied and maintenance as unavailable only", async () => {
  const service = await createService([
    zone({
      id: "mixed-zone",
      name: "Mixed Zone",
      capacity: 5,
      statuses: [
        "available",
        "occupied",
        "reserved",
        "maintenanceRequired",
        "maintenanceRequired",
      ],
      distanceFromEntryMeters: 50,
    }),
  ]);

  const recommendation = await service.getNearestAvailableZone();

  assert.equal(recommendation.availableSpots, 1);
  assert.equal(recommendation.occupiedSpots, 1);
  assert.equal(recommendation.reservedSpots, 1);
  assert.equal(recommendation.maintenanceRequiredSpots, 2);
  assert.equal(recommendation.occupancyRate, 40);
});

test("RecommendationService returns controlled empty results when no zone is available", async () => {
  const generatedAt = new Date("2026-05-20T00:00:00.000Z");
  const service = await createService([
    zone({
      id: "full-zone",
      name: "Full Zone",
      statuses: ["occupied", "reserved", "maintenanceRequired"],
      distanceFromEntryMeters: 10,
    }),
  ]);

  assert.equal(await service.getNearestAvailableZone(), null);
  assert.equal(await service.getLeastCongestedZone(), null);

  const response = await service.getZoneRecommendations(generatedAt);
  assert.equal(response.nearestAvailableZone, null);
  assert.equal(response.leastCongestedZone, null);
  assert.deepEqual(response.recommendations, []);
  assert.equal(response.generatedAt.toISOString(), generatedAt.toISOString());
});
