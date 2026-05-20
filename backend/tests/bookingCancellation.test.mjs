import assert from "node:assert/strict";
import test from "node:test";

async function createService(overrides = {}) {
  const { BookingService } = await import("../dist/services/bookingService.js");

  const bookingRepository = {
    findByIdForUser: async () => ({
      id: "booking-1",
      userId: "user-1",
      spotId: "spot-1",
      status: "confirmed",
      startTime: new Date("2026-05-16T01:00:00.000Z"),
      endTime: new Date("2026-05-16T02:00:00.000Z"),
      spot: {
        id: "spot-1",
        zoneId: "zone-1",
        spotCode: "A-001",
        status: "reserved",
      },
    }),
    cancelBooking: async () => ({
      id: "booking-1",
      userId: "user-1",
      spotId: "spot-1",
      status: "cancelled",
      startTime: new Date("2026-05-16T01:00:00.000Z"),
      endTime: new Date("2026-05-16T02:00:00.000Z"),
      spot: {
        id: "spot-1",
        zoneId: "zone-1",
        spotCode: "A-001",
        status: "reserved",
      },
    }),
    countActiveBlockingBookingsForSpot: async () => 0,
    updateSpotStatus: async () => ({
      id: "spot-1",
      zoneId: "zone-1",
      spotCode: "A-001",
      status: "available",
    }),
  };

  const occupancyService = {
    getZoneDetail: async () => ({
      zoneId: "zone-1",
      name: "Zone A",
      capacity: 10,
      availableSpots: 10,
      occupiedSpots: 0,
      reservedSpots: 0,
      maintenanceRequiredSpots: 0,
      occupancyRate: "0.00",
      spots: [],
    }),
  };

  const broadcasts = [];
  const parkingEventStream = {
    broadcastParkingUpdate: (event) => {
      broadcasts.push(event);
    },
  };

  const deps = {
    bookingRepository: Object.assign(bookingRepository, overrides.bookingRepository),
    occupancyService: Object.assign(occupancyService, overrides.occupancyService),
    parkingEventStream: Object.assign(parkingEventStream, overrides.parkingEventStream),
    broadcasts,
  };

  const service = new BookingService(
    deps.bookingRepository,
    { findById: async () => ({ id: "user-1", accountStatus: "active" }) },
    { findActiveCoveringWindow: async () => null },
    { findById: async () => null },
    { createConfirmationNotification: async () => null },
    deps.occupancyService,
    deps.parkingEventStream,
  );

  return { service, deps };
}

test("BookingService cancels an upcoming booking and releases the reserved spot when safe", async () => {
  const { service, deps } = await createService();
  const result = await service.cancelBooking(
    "user-1",
    "booking-1",
    new Date("2026-05-15T00:00:00.000Z"),
  );

  assert.equal(result.booking.status, "cancelled");
  assert.equal(result.parkingSpot?.status, "available");
  assert.equal(deps.broadcasts.length, 1);
  assert.equal(deps.broadcasts[0].spotId, "spot-1");
  assert.equal(deps.broadcasts[0].status, "available");
});

test("BookingService cancellation does not release spot when another active booking exists", async () => {
  const { service, deps } = await createService({
    bookingRepository: {
      countActiveBlockingBookingsForSpot: async () => 1,
    },
  });

  const result = await service.cancelBooking(
    "user-1",
    "booking-1",
    new Date("2026-05-15T00:00:00.000Z"),
  );

  assert.equal(result.booking.status, "cancelled");
  assert.equal(result.parkingSpot, null);
  assert.equal(deps.broadcasts.length, 0);
});

test("BookingService cancellation rejects unknown or non-owned bookings", async () => {
  const { BookingNotFoundError } = await import("../dist/services/bookingService.js");
  const { service } = await createService({
    bookingRepository: {
      findByIdForUser: async () => null,
    },
  });

  await assert.rejects(
    () => service.cancelBooking("user-1", "booking-404", new Date("2026-05-15T00:00:00.000Z")),
    (error) => error instanceof BookingNotFoundError,
  );
});

test("BookingService cancellation rejects terminal booking statuses", async () => {
  const { BookingCancellationConflictError } = await import("../dist/services/bookingService.js");
  const { service } = await createService({
    bookingRepository: {
      findByIdForUser: async () => ({
        id: "booking-1",
        spotId: "spot-1",
        status: "completed",
        startTime: new Date("2026-05-16T01:00:00.000Z"),
        endTime: new Date("2026-05-16T02:00:00.000Z"),
        spot: { id: "spot-1", zoneId: "zone-1", status: "reserved" },
      }),
    },
  });

  await assert.rejects(
    () => service.cancelBooking("user-1", "booking-1", new Date("2026-05-15T00:00:00.000Z")),
    (error) =>
      error instanceof BookingCancellationConflictError &&
      error.message === "Only pending or confirmed bookings can be cancelled.",
  );
});

test("BookingService cancellation rejects non-upcoming bookings", async () => {
  const { BookingCancellationConflictError } = await import("../dist/services/bookingService.js");
  const { service } = await createService({
    bookingRepository: {
      findByIdForUser: async () => ({
        id: "booking-1",
        spotId: "spot-1",
        status: "confirmed",
        startTime: new Date("2026-05-14T01:00:00.000Z"),
        endTime: new Date("2026-05-14T02:00:00.000Z"),
        spot: { id: "spot-1", zoneId: "zone-1", status: "reserved" },
      }),
    },
  });

  await assert.rejects(
    () => service.cancelBooking("user-1", "booking-1", new Date("2026-05-15T00:00:00.000Z")),
    (error) =>
      error instanceof BookingCancellationConflictError &&
      error.message === "Only upcoming bookings can be cancelled.",
  );
});
