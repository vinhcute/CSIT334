import assert from "node:assert/strict";
import test from "node:test";

function createDependencies(overrides = {}) {
  const bookingRepository = {
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
        status: "reserved",
      },
    }),
    listForAdmin: async () => [],
    findById: async () => null,
  };

  const userRepository = {
    findById: async () => ({
      id: "user-1",
      accountStatus: "active",
    }),
  };

  const subscriptionRepository = {
    findActiveCoveringWindow: async () => ({
      id: "subscription-1",
      startTime: new Date("2026-01-01T00:00:00.000Z"),
      endTime: new Date("2026-12-31T23:59:59.000Z"),
    }),
  };

  const parkingSpotRepository = {
    findById: async () => ({
      id: "spot-1",
      status: "available",
    }),
  };

  const bookingNotificationService = {
    createConfirmationNotification: async () => null,
  };
  const occupancyService = {
    getZoneDetail: async () => ({
      zoneId: "zone-1",
      name: "Zone A",
      capacity: 10,
      availableSpots: 8,
      occupiedSpots: 1,
      reservedSpots: 1,
      maintenanceRequiredSpots: 0,
      occupancyRate: "20.00",
      spots: [],
    }),
  };
  const parkingEventStream = {
    broadcastParkingUpdate: () => null,
  };

  return {
    bookingRepository: Object.assign(bookingRepository, overrides.bookingRepository),
    userRepository: Object.assign(userRepository, overrides.userRepository),
    subscriptionRepository: Object.assign(
      subscriptionRepository,
      overrides.subscriptionRepository,
    ),
    parkingSpotRepository: Object.assign(parkingSpotRepository, overrides.parkingSpotRepository),
    bookingNotificationService: Object.assign(
      bookingNotificationService,
      overrides.bookingNotificationService,
    ),
    occupancyService: Object.assign(occupancyService, overrides.occupancyService),
    parkingEventStream: Object.assign(parkingEventStream, overrides.parkingEventStream),
  };
}

async function createService(overrides = {}) {
  const {
    BookingService,
  } = await import("../dist/services/bookingService.js");
  const deps = createDependencies(overrides);

  return {
    service: new BookingService(
      deps.bookingRepository,
      deps.userRepository,
      deps.subscriptionRepository,
      deps.parkingSpotRepository,
      deps.bookingNotificationService,
      deps.occupancyService,
      deps.parkingEventStream,
    ),
    deps,
  };
}

test("BookingService creates a confirmed booking and spot reservation", async () => {
  const now = new Date("2026-05-15T00:00:00.000Z");
  const startTime = new Date("2026-05-15T01:00:00.000Z");
  const endTime = new Date("2026-05-15T02:30:00.000Z");
  let capturedInput = null;
  let confirmationBookingId = null;
  const { service } = await createService({
    bookingRepository: {
      createConfirmedBookingWithSpotReservation: async (input) => {
        capturedInput = input;
        return {
          booking: { id: "booking-1", ...input, status: "confirmed" },
          parkingSpot: { id: input.spotId, status: "reserved" },
        };
      },
    },
    bookingNotificationService: {
      createConfirmationNotification: async (booking) => {
        confirmationBookingId = booking.id;
      },
    },
  });

  const result = await service.createBooking(
    "user-1",
    {
      spotId: "spot-1",
      startTime,
      endTime,
    },
    now,
  );

  assert.equal(result.booking.status, "confirmed");
  assert.equal(result.parkingSpot.status, "reserved");
  assert.equal(capturedInput.userId, "user-1");
  assert.equal(capturedInput.spotId, "spot-1");
  assert.equal(capturedInput.startTime.toISOString(), startTime.toISOString());
  assert.equal(capturedInput.endTime.toISOString(), endTime.toISOString());
  assert.equal(
    capturedInput.expiresAt.toISOString(),
    new Date("2026-05-15T01:15:00.000Z").toISOString(),
  );
  assert.equal(confirmationBookingId, "booking-1");
});

test("BookingService rejects windows that start in the past or now", async () => {
  const {
    BookingValidationError,
  } = await import("../dist/services/bookingService.js");
  const now = new Date("2026-05-15T00:00:00.000Z");
  const { service } = await createService();

  await assert.rejects(
    () =>
      service.createBooking(
        "user-1",
        {
          spotId: "spot-1",
          startTime: "2026-05-15T00:00:00.000Z",
          endTime: "2026-05-15T02:00:00.000Z",
        },
        now,
      ),
    (error) =>
      error instanceof BookingValidationError &&
      error.issues.includes("Start time must be in the future."),
  );
});

test("BookingService rejects windows where end time is not after start time", async () => {
  const {
    BookingValidationError,
  } = await import("../dist/services/bookingService.js");
  const now = new Date("2026-05-15T00:00:00.000Z");
  const { service } = await createService();

  await assert.rejects(
    () =>
      service.createBooking(
        "user-1",
        {
          spotId: "spot-1",
          startTime: "2026-05-15T02:00:00.000Z",
          endTime: "2026-05-15T02:00:00.000Z",
        },
        now,
      ),
    (error) =>
      error instanceof BookingValidationError &&
      error.issues.includes("End time must be after start time."),
  );
});

test("BookingService rejects disabled users", async () => {
  const {
    BookingAccountDisabledError,
  } = await import("../dist/services/bookingService.js");
  const { service } = await createService({
    userRepository: {
      findById: async () => ({ id: "user-1", accountStatus: "disabled" }),
    },
  });

  const now = new Date("2026-05-15T00:00:00.000Z");
  await assert.rejects(
    () =>
      service.createBooking("user-1", {
        spotId: "spot-1",
        startTime: "2026-05-15T01:00:00.000Z",
        endTime: "2026-05-15T02:00:00.000Z",
      }, now),
    (error) => error instanceof BookingAccountDisabledError,
  );
});

test("BookingService rejects users without eligible active subscriptions", async () => {
  const {
    BookingSubscriptionEligibilityError,
  } = await import("../dist/services/bookingService.js");
  const { service } = await createService({
    subscriptionRepository: {
      findActiveCoveringWindow: async () => null,
    },
  });

  const now = new Date("2026-05-15T00:00:00.000Z");
  await assert.rejects(
    () =>
      service.createBooking("user-1", {
        spotId: "spot-1",
        startTime: "2026-05-15T01:00:00.000Z",
        endTime: "2026-05-15T02:00:00.000Z",
      }, now),
    (error) => error instanceof BookingSubscriptionEligibilityError,
  );
});

test("BookingService accepts a booking when one active subscription covers the window", async () => {
  const now = new Date("2026-05-15T00:00:00.000Z");
  const { service } = await createService({
    subscriptionRepository: {
      findActiveCoveringWindow: async () => ({
        id: "subscription-covering",
        startTime: new Date("2026-05-01T00:00:00.000Z"),
        endTime: new Date("2026-07-22T23:59:59.000Z"),
      }),
    },
  });

  const result = await service.createBooking(
    "user-1",
    {
      spotId: "spot-1",
      startTime: "2026-05-16T01:15:00.000Z",
      endTime: "2026-05-16T02:15:00.000Z",
    },
    now,
  );

  assert.equal(result.booking.status, "confirmed");
});

test("BookingService rejects maintenance-required spots", async () => {
  const {
    BookingSpotMaintenanceConflictError,
  } = await import("../dist/services/bookingService.js");
  const { service } = await createService({
    parkingSpotRepository: {
      findById: async () => ({ id: "spot-1", status: "maintenanceRequired" }),
    },
  });

  const now = new Date("2026-05-15T00:00:00.000Z");
  await assert.rejects(
    () =>
      service.createBooking("user-1", {
        spotId: "spot-1",
        startTime: "2026-05-15T01:00:00.000Z",
        endTime: "2026-05-15T02:00:00.000Z",
      }, now),
    (error) => error instanceof BookingSpotMaintenanceConflictError,
  );
});

test("BookingService rejects immediate bookings for currently occupied spots", async () => {
  const {
    BookingSpotOccupiedConflictError,
  } = await import("../dist/services/bookingService.js");
  const now = new Date("2026-05-15T00:00:00.000Z");
  const { service } = await createService({
    parkingSpotRepository: {
      findById: async () => ({ id: "spot-1", status: "occupied" }),
    },
  });

  await assert.rejects(
    () =>
      service.createBooking(
        "user-1",
        {
          spotId: "spot-1",
          startTime: "2026-05-15T00:03:00.000Z",
          endTime: "2026-05-15T01:00:00.000Z",
        },
        now,
      ),
    (error) => error instanceof BookingSpotOccupiedConflictError,
  );
});

test("BookingService rejects overlapping active bookings", async () => {
  const {
    BookingConflictError,
  } = await import("../dist/services/bookingService.js");
  const { service } = await createService({
    bookingRepository: {
      findOverlappingActiveBooking: async () => ({ id: "existing-booking-id" }),
    },
  });

  const now = new Date("2026-05-15T00:00:00.000Z");
  await assert.rejects(
    () =>
      service.createBooking("user-1", {
        spotId: "spot-1",
        startTime: "2026-05-15T01:00:00.000Z",
        endTime: "2026-05-15T02:00:00.000Z",
      }, now),
    (error) => error instanceof BookingConflictError,
  );
});

test("BookingService validates admin booking filters", async () => {
  const { BookingValidationError } = await import("../dist/services/bookingService.js");
  const { service } = await createService();

  await assert.rejects(
    () =>
      service.listAdminBookings({
        status: "confirmed",
        from: "2026-05-16T00:00:00.000Z",
        to: "2026-05-15T00:00:00.000Z",
      }),
    (error) =>
      error instanceof BookingValidationError &&
      error.issues.includes("From date must be before or equal to to date."),
  );
});

test("BookingService returns admin booking detail and throws when missing", async () => {
  const { BookingNotFoundError } = await import("../dist/services/bookingService.js");
  const { service } = await createService({
    bookingRepository: {
      findById: async (id) => (id === "booking-1" ? { id, status: "confirmed" } : null),
    },
  });

  const booking = await service.getAdminBooking("booking-1");
  assert.equal(booking.id, "booking-1");

  await assert.rejects(
    () => service.getAdminBooking("missing"),
    (error) => error instanceof BookingNotFoundError,
  );
});

test("BookingService lists and fetches current user bookings with ownership", async () => {
  const { BookingNotFoundError } = await import("../dist/services/bookingService.js");
  const ownedBooking = { id: "booking-1", status: "confirmed" };
  const { service } = await createService({
    bookingRepository: {
      listForUser: async () => [ownedBooking],
      findByIdForUser: async (_bookingId, userId) => (userId === "user-1" ? ownedBooking : null),
    },
  });

  const list = await service.listMyBookings("user-1");
  assert.equal(list.length, 1);
  assert.equal(list[0].id, "booking-1");

  const detail = await service.getMyBooking("user-1", "booking-1");
  assert.equal(detail.id, "booking-1");

  await assert.rejects(
    () => service.getMyBooking("user-2", "booking-1"),
    (error) => error instanceof BookingNotFoundError,
  );
});
