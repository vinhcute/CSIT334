import assert from "node:assert/strict";
import test from "node:test";

function createDueBooking({
  id,
  spotId = "spot-1",
  status = "confirmed",
  spotStatus = "reserved",
}) {
  return {
    id,
    spotId,
    status,
    spot: {
      id: spotId,
      zoneId: "zone-1",
      spotCode: `${spotId}-code`,
      status: spotStatus,
    },
  };
}

async function createService(overrides = {}) {
  const {
    BookingExpirationService,
  } = await import("../dist/services/bookingExpirationService.js");

  const expiredCalls = [];
  const releasedCalls = [];
  const broadcasts = [];
  const bookingRepository = {
    findExpirableBookings: async () => [createDueBooking({ id: "booking-1" })],
    expireBooking: async (bookingId) => {
      expiredCalls.push(bookingId);
      return createDueBooking({ id: bookingId });
    },
    countActiveBlockingBookingsForSpot: async () => 0,
    updateSpotStatus: async (spotId) => {
      releasedCalls.push(spotId);
      return {
        id: spotId,
        zoneId: "zone-1",
        status: "available",
      };
    },
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
  const parkingEventStream = {
    broadcastParkingUpdate: (event) => {
      broadcasts.push(event);
    },
  };

  const deps = {
    bookingRepository: Object.assign(bookingRepository, overrides.bookingRepository),
    occupancyService: Object.assign(occupancyService, overrides.occupancyService),
    parkingEventStream: Object.assign(parkingEventStream, overrides.parkingEventStream),
    expiredCalls,
    releasedCalls,
    broadcasts,
  };

  return {
    service: new BookingExpirationService(
      deps.bookingRepository,
      deps.occupancyService,
      deps.parkingEventStream,
    ),
    deps,
  };
}

test("BookingExpirationService expires due bookings and releases reserved spots when safe", async () => {
  const { service, deps } = await createService();
  const result = await service.expireDueBookings(new Date("2026-05-15T00:00:00.000Z"));

  assert.equal(result.scanned, 1);
  assert.equal(result.expired, 1);
  assert.equal(result.releasedSpots, 1);
  assert.deepEqual(deps.expiredCalls, ["booking-1"]);
  assert.deepEqual(deps.releasedCalls, ["spot-1"]);
  assert.equal(deps.broadcasts.length, 1);
  assert.equal(deps.broadcasts[0].status, "available");
});

test("BookingExpirationService does not release occupied spots", async () => {
  const { service, deps } = await createService({
    bookingRepository: {
      expireBooking: async () => createDueBooking({ id: "booking-1", spotStatus: "occupied" }),
    },
  });
  const result = await service.expireDueBookings();

  assert.equal(result.expired, 1);
  assert.equal(result.releasedSpots, 0);
  assert.deepEqual(deps.releasedCalls, []);
  assert.equal(deps.broadcasts.length, 0);
});

test("BookingExpirationService does not release spot with another active blocking booking", async () => {
  const { service, deps } = await createService({
    bookingRepository: {
      countActiveBlockingBookingsForSpot: async () => 2,
    },
  });
  const result = await service.expireDueBookings();

  assert.equal(result.expired, 1);
  assert.equal(result.releasedSpots, 0);
  assert.deepEqual(deps.releasedCalls, []);
  assert.equal(deps.broadcasts.length, 0);
});

test("BookingExpirationService skips when there are no due bookings", async () => {
  const { service, deps } = await createService({
    bookingRepository: {
      findExpirableBookings: async () => [],
    },
  });
  const result = await service.expireDueBookings();

  assert.equal(result.scanned, 0);
  assert.equal(result.expired, 0);
  assert.equal(result.releasedSpots, 0);
  assert.deepEqual(deps.expiredCalls, []);
});
