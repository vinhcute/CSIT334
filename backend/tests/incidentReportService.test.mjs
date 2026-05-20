import assert from "node:assert/strict";
import test from "node:test";

function makeReport(overrides = {}) {
  return {
    id: "incident-1",
    userId: "user-1",
    status: "open",
    issueType: "spotDiscrepancy",
    description: "Vehicle was parked in a reserved spot without authorisation.",
    resolution: null,
    resolvedAt: null,
    createdAt: new Date("2026-05-21T00:00:00.000Z"),
    updatedAt: new Date("2026-05-21T00:00:00.000Z"),
    spot: {
      id: "spot-1",
      spotCode: "A-001",
      status: "occupied",
      level: "Ground",
      rowLabel: "A",
      zone: {
        id: "zone-1",
        name: "North Lot",
      },
    },
    user: {
      id: "user-1",
      name: "Driver User",
      email: "driver@example.test",
    },
    ...overrides,
  };
}

function createRepository(overrides = {}) {
  const state = {
    reports: [makeReport()],
    lastCreated: null,
    lastAdminFilters: null,
  };

  return {
    state,
    async findSpotExists(spotId) {
      return spotId === "spot-1";
    },
    async create(input) {
      state.lastCreated = input;
      const report = makeReport({
        id: "incident-created",
        userId: input.userId,
        issueType: input.issueType,
        description: input.description,
        spot: input.spotId
          ? makeReport().spot
          : null,
      });
      state.reports = [report, ...state.reports];
      return report;
    },
    async listByUserId(userId) {
      return state.reports.filter((report) => report.userId === userId);
    },
    async listForAdmin(filters) {
      state.lastAdminFilters = filters;
      return state.reports.filter((report) => {
        if (filters.status && report.status !== filters.status) {
          return false;
        }
        if (filters.issueType && report.issueType !== filters.issueType) {
          return false;
        }
        if (filters.spotId && report.spot?.id !== filters.spotId) {
          return false;
        }
        return true;
      });
    },
    async findById(id) {
      return state.reports.find((report) => report.id === id) ?? null;
    },
    async markInReview(id) {
      const report = state.reports.find((entry) => entry.id === id);
      report.status = "inReview";
      return report;
    },
    async resolve(id, resolution, resolvedAt) {
      const report = state.reports.find((entry) => entry.id === id);
      report.status = "resolved";
      report.resolution = resolution;
      report.resolvedAt = resolvedAt;
      return report;
    },
    ...overrides,
  };
}

function createSpotRepository(overrides = {}) {
  const state = {
    updateCalls: [],
    spot: {
      id: "spot-1",
      zoneId: "zone-1",
      status: "occupied",
    },
  };

  return {
    state,
    async findById(id) {
      if (id !== "spot-1") {
        return null;
      }

      return state.spot;
    },
    async update(id, input) {
      state.updateCalls.push({ id, input });
      state.spot = {
        ...state.spot,
        id,
        ...input,
      };
      return state.spot;
    },
    ...overrides,
  };
}

function createOccupancyService(overrides = {}) {
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
        capacity: 50,
        distanceFromEntryMeters: 120,
        displayOrder: 1,
        availableSpots: 10,
        occupiedSpots: 30,
        reservedSpots: 5,
        maintenanceRequiredSpots: 5,
        occupancyRate: "70.00",
        spots: [],
      };
    },
    async recordZoneHistory(zoneId) {
      state.recordZoneHistoryCalls.push(zoneId);
      return { zoneId };
    },
    ...overrides,
  };
}

function createParkingEventStream(overrides = {}) {
  const state = {
    events: [],
  };

  return {
    state,
    broadcastParkingUpdate(event) {
      state.events.push(event);
    },
    ...overrides,
  };
}

test("IncidentReportService validates create input and spot existence", async () => {
  const { IncidentReportService, IncidentReportValidationError, IncidentReportSpotNotFoundError } =
    await import("../dist/services/incidentReportService.js");
  const service = new IncidentReportService(
    createRepository(),
    createSpotRepository(),
    createOccupancyService(),
    createParkingEventStream(),
  );

  await assert.rejects(
    () => service.createReport("user-1", { issueType: "other", description: "short" }),
    (error) =>
      error instanceof IncidentReportValidationError &&
      error.issues.includes("Description must be at least 10 characters."),
  );

  await assert.rejects(
    () =>
      service.createReport("user-1", {
        issueType: "sensorFault",
        description: "Sensor mismatch persisted for ten minutes.",
        spotId: "spot-missing",
      }),
    (error) => error instanceof IncidentReportSpotNotFoundError,
  );
});

test("IncidentReportService creates reports and lists user-scoped results", async () => {
  const { IncidentReportService } = await import("../dist/services/incidentReportService.js");
  const repository = createRepository();
  const spotRepository = createSpotRepository();
  const occupancyService = createOccupancyService();
  const eventStream = createParkingEventStream();
  const service = new IncidentReportService(
    repository,
    spotRepository,
    occupancyService,
    eventStream,
  );

  const created = await service.createReport("user-1", {
    issueType: "spotDiscrepancy",
    description: "Reserved bay was occupied by a different vehicle for over 15 minutes.",
    spotId: "spot-1",
  });
  const mine = await service.listMyReports("user-1");

  assert.equal(created.id, "incident-created");
  assert.equal(repository.state.lastCreated.userId, "user-1");
  assert.equal(mine.length >= 1, true);
  assert.equal(mine[0].reporter.email, "driver@example.test");
  assert.equal(mine[0].spot.spotCode, "A-001");
  assert.equal(spotRepository.state.updateCalls.length, 1);
  assert.equal(occupancyService.state.recordZoneHistoryCalls.length, 1);
  assert.equal(eventStream.state.events.length, 1);
});

test("IncidentReportService applies admin filters and validates admin filter input", async () => {
  const { IncidentReportService, IncidentReportValidationError } = await import(
    "../dist/services/incidentReportService.js"
  );
  const repository = createRepository();
  const service = new IncidentReportService(
    repository,
    createSpotRepository(),
    createOccupancyService(),
    createParkingEventStream(),
  );

  const filtered = await service.listAdminReports({
    status: "open",
    issueType: "spotDiscrepancy",
    spotId: "spot-1",
  });

  assert.equal(filtered.length, 1);
  assert.equal(repository.state.lastAdminFilters.status, "open");

  await assert.rejects(
    () => service.listAdminReports({ status: "closed" }),
    (error) =>
      error instanceof IncidentReportValidationError &&
      error.issues.some((issue) => issue.includes("Invalid option")),
  );
});

test("IncidentReportService enforces in-review transition rules", async () => {
  const { IncidentReportService, IncidentReportTransitionConflictError, IncidentReportNotFoundError } =
    await import("../dist/services/incidentReportService.js");
  const service = new IncidentReportService(
    createRepository(),
    createSpotRepository(),
    createOccupancyService(),
    createParkingEventStream(),
  );

  const inReview = await service.markInReview("incident-1");
  assert.equal(inReview.status, "inReview");

  await assert.rejects(
    () => service.markInReview("incident-1"),
    (error) =>
      error instanceof IncidentReportTransitionConflictError &&
      error.message.includes("Only open incident reports"),
  );

  await assert.rejects(
    () => service.markInReview("missing-incident"),
    (error) => error instanceof IncidentReportNotFoundError,
  );
});

test("IncidentReportService enforces resolve transition and resolution validation", async () => {
  const {
    IncidentReportService,
    IncidentReportTransitionConflictError,
    IncidentReportValidationError,
  } = await import("../dist/services/incidentReportService.js");
  const now = new Date("2026-05-21T08:15:00.000Z");
  const serviceWithDeps = new IncidentReportService(
    createRepository(),
    createSpotRepository(),
    createOccupancyService(),
    createParkingEventStream(),
  );

  await assert.rejects(
    () => serviceWithDeps.resolve("incident-1", { resolution: "ok" }, now),
    (error) =>
      error instanceof IncidentReportValidationError &&
      error.issues.includes("Resolution must be at least 5 characters."),
  );

  const resolved = await serviceWithDeps.resolve(
    "incident-1",
    { resolution: "Admin confirmed spot signage was corrected and bay is now compliant." },
    now,
  );
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.resolvedAt, now);

  await assert.rejects(
    () =>
      serviceWithDeps.resolve(
        "incident-1",
        { resolution: "Attempting a second resolution should fail." },
        now,
      ),
    (error) =>
      error instanceof IncidentReportTransitionConflictError &&
      error.message.includes("cannot be resolved again"),
  );
});
