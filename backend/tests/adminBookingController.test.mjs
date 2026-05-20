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

test("AdminBookingController lists admin bookings with validated filters", async () => {
  const { AdminBookingController } = await import("../dist/controllers/adminBookingController.js");
  let capturedFilters = null;
  const controller = new AdminBookingController({
    listAdminBookings: async (filters) => {
      capturedFilters = filters;
      return {
        bookings: [{ id: "booking-1", status: "confirmed" }],
        pagination: { page: 2, pageSize: 10, total: 31, totalPages: 4 },
      };
    },
  });
  const response = createResponse();

  await controller.index(
    {
      query: {
        page: "2",
        pageSize: "10",
        status: "confirmed",
        from: "2026-05-15T00:00:00.000Z",
        to: "2026-05-16T00:00:00.000Z",
        userId: "user-1",
        userSearch: "minh",
        zoneName: "north",
      },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.bookings.length, 1);
  assert.equal(response.body.pagination.page, 2);
  assert.equal(response.body.pagination.pageSize, 10);
  assert.equal(capturedFilters.status, "confirmed");
  assert.equal(capturedFilters.page, "2");
  assert.equal(capturedFilters.pageSize, "10");
  assert.equal(capturedFilters.userSearch, "minh");
  assert.equal(capturedFilters.zoneName, "north");
});

test("AdminBookingController returns 400 when filters are invalid", async () => {
  const { AdminBookingController } = await import("../dist/controllers/adminBookingController.js");
  const { BookingValidationError } = await import("../dist/services/bookingService.js");
  const controller = new AdminBookingController({
    listAdminBookings: async () => {
      throw new BookingValidationError(["From date must be before or equal to to date."]);
    },
  });
  const response = createResponse();

  await controller.index({ query: {} }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, "Booking input is invalid.");
});

test("AdminBookingController returns booking detail", async () => {
  const { AdminBookingController } = await import("../dist/controllers/adminBookingController.js");
  const controller = new AdminBookingController({
    getAdminBooking: async (id) => ({ id, status: "confirmed" }),
  });
  const response = createResponse();

  await controller.show({ params: { id: "booking-1" } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.booking.id, "booking-1");
});
