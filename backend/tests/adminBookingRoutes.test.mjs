import assert from "node:assert/strict";
import test from "node:test";

function getRouteLayers(router, method, path) {
  return router.stack.find(
    (layer) =>
      layer.route &&
      layer.route.path === path &&
      Object.prototype.hasOwnProperty.call(layer.route.methods, method),
  )?.route.stack;
}

test("admin booking router mounts list and detail routes with admin-only middleware chain", async () => {
  const { createAdminBookingsRouter } = await import("../dist/routes/adminBookings.js");
  const router = createAdminBookingsRouter(
    {
      listAdminBookings: async () => [],
      getAdminBooking: async () => ({ id: "booking-1" }),
    },
    (_request, _response, next) => next(),
  );

  const listRouteLayers = getRouteLayers(router, "get", "/api/admin/bookings");
  const detailRouteLayers = getRouteLayers(router, "get", "/api/admin/bookings/:id");

  assert.equal(Array.isArray(listRouteLayers), true);
  assert.equal(Array.isArray(detailRouteLayers), true);
  assert.equal(listRouteLayers.length >= 3, true);
  assert.equal(detailRouteLayers.length >= 3, true);
});
