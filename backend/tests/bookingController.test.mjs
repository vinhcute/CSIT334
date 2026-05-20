import assert from "node:assert/strict";
import test from "node:test";

function createResponse() {
  const response = {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  return response;
}

test("BookingController returns 401 when request user is missing", async () => {
  const { BookingController } = await import("../dist/controllers/bookingController.js");
  const controller = new BookingController();
  const response = createResponse();

  await controller.create({ body: {} }, response);

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: "Authentication required." });
});

test("BookingController returns 201 for successful booking creation", async () => {
  const { BookingController } = await import("../dist/controllers/bookingController.js");
  const controller = new BookingController({
    createBooking: async () => ({
      booking: { id: "booking-1", status: "confirmed" },
      parkingSpot: { id: "spot-1", status: "reserved" },
    }),
  });
  const response = createResponse();

  await controller.create(
    {
      user: { userId: "user-1", role: "driver", accountStatus: "active" },
      body: { spotId: "spot-1", startTime: "2026-05-16T01:00:00.000Z", endTime: "2026-05-16T02:00:00.000Z" },
    },
    response,
  );

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.booking.status, "confirmed");
  assert.equal(response.body.parkingSpot.status, "reserved");
});

test("BookingController lists the current user's bookings", async () => {
  const { BookingController } = await import("../dist/controllers/bookingController.js");
  const controller = new BookingController({
    listMyBookings: async () => [{ id: "booking-1", status: "confirmed" }],
  });
  const response = createResponse();

  await controller.indexMine(
    {
      user: { userId: "user-1", role: "driver", accountStatus: "active" },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.bookings.length, 1);
});

test("BookingController returns owned booking detail", async () => {
  const { BookingController } = await import("../dist/controllers/bookingController.js");
  const controller = new BookingController({
    getMyBooking: async () => ({ id: "booking-1", status: "confirmed" }),
  });
  const response = createResponse();

  await controller.showMine(
    {
      user: { userId: "user-1", role: "driver", accountStatus: "active" },
      params: { id: "booking-1" },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.booking.id, "booking-1");
});

test("BookingController maps booking validation errors to 400", async () => {
  const {
    BookingController,
  } = await import("../dist/controllers/bookingController.js");
  const {
    BookingValidationError,
  } = await import("../dist/services/bookingService.js");
  const controller = new BookingController({
    createBooking: async () => {
      throw new BookingValidationError(["Start time must be in the future."]);
    },
  });
  const response = createResponse();

  await controller.create(
    {
      user: { userId: "user-1", role: "driver", accountStatus: "active" },
      body: {},
    },
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, "Booking input is invalid.");
  assert.deepEqual(response.body.issues, ["Start time must be in the future."]);
});

test("BookingController maps account and eligibility errors to 403", async () => {
  const {
    BookingController,
  } = await import("../dist/controllers/bookingController.js");
  const {
    BookingAccountDisabledError,
  } = await import("../dist/services/bookingService.js");
  const controller = new BookingController({
    createBooking: async () => {
      throw new BookingAccountDisabledError();
    },
  });
  const response = createResponse();

  await controller.create(
    {
      user: { userId: "user-1", role: "driver", accountStatus: "active" },
      body: {},
    },
    response,
  );

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error, "Disabled accounts cannot create bookings.");
});

test("BookingController maps conflict errors to 409", async () => {
  const {
    BookingController,
  } = await import("../dist/controllers/bookingController.js");
  const {
    BookingConflictError,
  } = await import("../dist/services/bookingService.js");
  const controller = new BookingController({
    createBooking: async () => {
      throw new BookingConflictError();
    },
  });
  const response = createResponse();

  await controller.create(
    {
      user: { userId: "user-1", role: "driver", accountStatus: "active" },
      body: {},
    },
    response,
  );

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.error, "This parking spot already has an overlapping booking.");
});

test("BookingController cancel returns booking payload", async () => {
  const { BookingController } = await import("../dist/controllers/bookingController.js");
  const controller = new BookingController({
    cancelBooking: async () => ({
      booking: { id: "booking-1", status: "cancelled" },
      parkingSpot: null,
    }),
  });
  const response = createResponse();

  await controller.cancel(
    {
      user: { userId: "user-1", role: "driver", accountStatus: "active" },
      params: { id: "booking-1" },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.booking.status, "cancelled");
});
