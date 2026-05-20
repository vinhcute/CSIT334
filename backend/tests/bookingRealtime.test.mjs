import assert from "node:assert/strict";
import test from "node:test";

async function createBookingServiceHarness() {
  const { BookingService } = await import("../dist/services/bookingService.js");
  const broadcasts = [];

  const service = new BookingService(
    {
      findOverlappingActiveBooking: async () => null,
      createConfirmedBookingWithSpotReservation: async (input) => ({
        booking: {
          id: "booking-1",
          userId: input.userId,
          spotId: input.spotId,
          status: "confirmed",
          startTime: input.startTime,
          endTime: input.endTime,
          expiresAt: input.expiresAt,
        },
        parkingSpot: {
          id: input.spotId,
          zoneId: "zone-1",
          status: "reserved",
        },
      }),
    },
    { findById: async () => ({ id: "user-1", accountStatus: "active" }) },
    {
      findActiveCoveringWindow: async () => ({
        id: "subscription-1",
        startTime: new Date("2026-01-01T00:00:00.000Z"),
        endTime: new Date("2026-12-31T23:59:59.000Z"),
      }),
    },
    { findById: async () => ({ id: "spot-1", status: "available" }) },
    { createConfirmationNotification: async () => null },
    {
      getZoneDetail: async () => ({
        zoneId: "zone-1",
        name: "Zone A",
        capacity: 10,
        availableSpots: 4,
        occupiedSpots: 3,
        reservedSpots: 2,
        maintenanceRequiredSpots: 1,
        occupancyRate: "60.00",
        spots: [],
      }),
    },
    {
      broadcastParkingUpdate: (event) => {
        broadcasts.push(event);
      },
    },
  );

  return { service, broadcasts };
}

async function createExpirationHarness() {
  const { BookingExpirationService } = await import(
    "../dist/services/bookingExpirationService.js"
  );
  const broadcasts = [];

  const service = new BookingExpirationService(
    {
      findExpirableBookings: async () => [
        {
          id: "booking-1",
          spotId: "spot-1",
          status: "confirmed",
          spot: { id: "spot-1", zoneId: "zone-1", status: "reserved" },
        },
      ],
      expireBooking: async () => ({
        id: "booking-1",
        spotId: "spot-1",
        status: "expired",
        spot: { id: "spot-1", zoneId: "zone-1", status: "reserved" },
      }),
      countActiveBlockingBookingsForSpot: async () => 0,
      updateSpotStatus: async () => ({
        id: "spot-1",
        zoneId: "zone-1",
        status: "available",
      }),
    },
    {
      getZoneDetail: async () => ({
        zoneId: "zone-1",
        name: "Zone A",
        capacity: 10,
        availableSpots: 7,
        occupiedSpots: 2,
        reservedSpots: 1,
        maintenanceRequiredSpots: 0,
        occupancyRate: "30.00",
        spots: [],
      }),
    },
    {
      broadcastParkingUpdate: (event) => {
        broadcasts.push(event);
      },
    },
  );

  return { service, broadcasts };
}

test("BookingService broadcasts parking-update when booking creation reserves a spot", async () => {
  const { service, broadcasts } = await createBookingServiceHarness();

  await service.createBooking(
    "user-1",
    {
      spotId: "spot-1",
      startTime: "2026-06-01T01:00:00.000Z",
      endTime: "2026-06-01T02:00:00.000Z",
    },
    new Date("2026-05-16T00:00:00.000Z"),
  );

  assert.equal(broadcasts.length, 1);
  assert.equal(broadcasts[0].spotId, "spot-1");
  assert.equal(broadcasts[0].zoneId, "zone-1");
  assert.equal(broadcasts[0].status, "reserved");
  assert.ok("zoneSummary" in broadcasts[0]);
  assert.equal("userId" in broadcasts[0], false);
  assert.equal("bookingId" in broadcasts[0], false);
  assert.equal("token" in broadcasts[0], false);
  assert.equal("universityId" in broadcasts[0], false);
  assert.equal("licencePlate" in broadcasts[0], false);
});

test("BookingExpirationService broadcasts parking-update when expiration releases a spot", async () => {
  const { service, broadcasts } = await createExpirationHarness();
  const result = await service.expireDueBookings(new Date("2026-06-01T03:00:00.000Z"));

  assert.equal(result.releasedSpots, 1);
  assert.equal(broadcasts.length, 1);
  assert.equal(broadcasts[0].spotId, "spot-1");
  assert.equal(broadcasts[0].zoneId, "zone-1");
  assert.equal(broadcasts[0].status, "available");
  assert.equal("userId" in broadcasts[0], false);
  assert.equal("bookingId" in broadcasts[0], false);
  assert.equal("universityId" in broadcasts[0], false);
});
