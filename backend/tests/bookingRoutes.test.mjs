import assert from "node:assert/strict";
import test from "node:test";

function listRouteSignatures(router) {
  return router.stack
    .filter((layer) => layer.route)
    .flatMap((layer) =>
      Object.keys(layer.route.methods).map(
        (method) => `${method.toUpperCase()} ${layer.route.path}`,
      ),
    );
}

test("booking router mounts read, create, and cancel endpoints", async () => {
  const { createBookingsRouter } = await import("../dist/routes/bookings.js");
  const router = createBookingsRouter(
    {
      listMyBookings: async () => [],
      getMyBooking: async () => ({ id: "b-1" }),
      createBooking: async () => ({ booking: { id: "b-1" }, parkingSpot: { id: "s-1" } }),
      cancelBooking: async () => ({ booking: { id: "b-1", status: "cancelled" }, parkingSpot: null }),
    },
    (_request, _response, next) => next(),
  );

  const signatures = listRouteSignatures(router);

  assert.equal(signatures.includes("GET /api/bookings/me"), true);
  assert.equal(signatures.includes("GET /api/bookings/:id"), true);
  assert.equal(signatures.includes("POST /api/bookings"), true);
  assert.equal(signatures.includes("POST /api/bookings/:id/cancel"), true);
});
