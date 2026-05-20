import assert from "node:assert/strict";
import test from "node:test";

function makeReport(overrides = {}) {
  return {
    id: "incident-flag-1",
    userId: "driver-1",
    status: "open",
    issueType: "spotDiscrepancy",
    description: "Spot status did not match on-ground occupancy for multiple checks.",
    resolution: null,
    resolvedAt: null,
    createdAt: new Date("2026-05-22T00:00:00.000Z"),
    updatedAt: new Date("2026-05-22T00:00:00.000Z"),
    spot: {
      id: "spot-1",
      spotCode: "A-001",
      status: "occupied",
      level: "Ground",
      rowLabel: "A",
      zone: { id: "zone-1", name: "North Lot" },
    },
    user: {
      id: "driver-1",
      name: "Driver One",
      email: "driver-1@example.test",
    },
    ...overrides,
  };
}

function createIncidentRepository() {
  return {
    async findSpotExists(spotId) {
      return spotId === "spot-1";
    },
    async create(input) {
      return makeReport({
        userId: input.userId,
        issueType: input.issueType,
        description: input.description,
        spot: input.spotId ? makeReport().spot : null,
      });
    },
    async listByUserId() {
      return [];
    },
    async listForAdmin() {
      return [];
    },
    async findById() {
      return null;
    },
    async markInReview() {
      throw new Error("not used");
    },
    async resolve() {
      throw new Error("not used");
    },
  };
}

function createSpotRepository(initialStatus = "available") {
  const state = {
    updateCalls: [],
    spot: {
      id: "spot-1",
      zoneId: "zone-1",
      status: initialStatus,
    },
  };

  return {
    state,
    async findById(id) {
      return id === "spot-1" ? state.spot : null;
    },
    async update(id, input) {
      state.updateCalls.push({ id, input });
      state.spot = { ...state.spot, ...input };
      return state.spot;
    },
  };
}

function createOccupancyService() {
  const state = {
    getZoneDetailCalls: [],
    recordZoneHistoryCalls: [],
  };

  return {
    state,
    async getZoneDetail(zoneId) {
      state.getZoneDetailCalls.push(zoneId);
      return {
        zoneId,
        name: "North Lot",
        description: null,
        capacity: 100,
        distanceFromEntryMeters: 120,
        displayOrder: 1,
        availableSpots: 60,
        occupiedSpots: 20,
        reservedSpots: 15,
        maintenanceRequiredSpots: 5,
        occupancyRate: "35.00",
        spots: [],
      };
    },
    async recordZoneHistory(zoneId) {
      state.recordZoneHistoryCalls.push(zoneId);
    },
  };
}

function createEventStream() {
  const state = { events: [] };

  return {
    state,
    broadcastParkingUpdate(event) {
      state.events.push(event);
    },
  };
}

test("spot discrepancy flags non-reserved spot as maintenance and broadcasts update", async () => {
  const { IncidentReportService } = await import("../dist/services/incidentReportService.js");
  const incidentRepository = createIncidentRepository();
  const spotRepository = createSpotRepository("occupied");
  const occupancyService = createOccupancyService();
  const eventStream = createEventStream();
  const service = new IncidentReportService(
    incidentRepository,
    spotRepository,
    occupancyService,
    eventStream,
  );

  await service.createReport("driver-1", {
    issueType: "spotDiscrepancy",
    description: "Spot was marked free but blocked repeatedly by an unknown vehicle.",
    spotId: "spot-1",
  });

  assert.equal(spotRepository.state.updateCalls.length, 1);
  assert.equal(spotRepository.state.updateCalls[0].input.status, "maintenanceRequired");
  assert.equal(occupancyService.state.getZoneDetailCalls.length, 1);
  assert.equal(occupancyService.state.recordZoneHistoryCalls.length, 1);
  assert.equal(eventStream.state.events.length, 1);
  assert.equal(eventStream.state.events[0].status, "maintenanceRequired");
});

test("spot discrepancy does not overwrite reserved spot status", async () => {
  const { IncidentReportService } = await import("../dist/services/incidentReportService.js");
  const incidentRepository = createIncidentRepository();
  const spotRepository = createSpotRepository("reserved");
  const occupancyService = createOccupancyService();
  const eventStream = createEventStream();
  const service = new IncidentReportService(
    incidentRepository,
    spotRepository,
    occupancyService,
    eventStream,
  );

  await service.createReport("driver-1", {
    issueType: "spotDiscrepancy",
    description: "Reserved status did not match physical signs at this bay location.",
    spotId: "spot-1",
  });

  assert.equal(spotRepository.state.updateCalls.length, 0);
  assert.equal(occupancyService.state.getZoneDetailCalls.length, 0);
  assert.equal(occupancyService.state.recordZoneHistoryCalls.length, 0);
  assert.equal(eventStream.state.events.length, 0);
});
