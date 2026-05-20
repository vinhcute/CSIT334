import assert from "node:assert/strict";
import test from "node:test";

async function loadBookingDomain() {
  return import("../dist/domain/booking.js");
}

test("Booking domain status helpers use the expected active and terminal state rules", async () => {
  const {
    isActiveBlockingBookingStatus,
    isDriverCancellableBookingStatus,
    isTerminalBookingStatus,
  } = await loadBookingDomain();

  assert.equal(isActiveBlockingBookingStatus("pending"), true);
  assert.equal(isActiveBlockingBookingStatus("confirmed"), true);
  assert.equal(isActiveBlockingBookingStatus("cancelled"), false);
  assert.equal(isActiveBlockingBookingStatus("expired"), false);
  assert.equal(isActiveBlockingBookingStatus("completed"), false);

  assert.equal(isTerminalBookingStatus("cancelled"), true);
  assert.equal(isTerminalBookingStatus("expired"), true);
  assert.equal(isTerminalBookingStatus("completed"), true);
  assert.equal(isTerminalBookingStatus("pending"), false);
  assert.equal(isTerminalBookingStatus("confirmed"), false);

  assert.equal(isDriverCancellableBookingStatus("pending"), true);
  assert.equal(isDriverCancellableBookingStatus("confirmed"), true);
  assert.equal(isDriverCancellableBookingStatus("cancelled"), false);
  assert.equal(isDriverCancellableBookingStatus("expired"), false);
  assert.equal(isDriverCancellableBookingStatus("completed"), false);
});

test("Booking cancellation eligibility only allows upcoming bookings", async () => {
  const { isEligibleUpcomingCancellation } = await loadBookingDomain();

  const now = new Date("2026-05-16T10:00:00.000Z");

  assert.equal(
    isEligibleUpcomingCancellation(new Date("2026-05-16T10:30:00.000Z"), now),
    true,
  );
  assert.equal(
    isEligibleUpcomingCancellation(new Date("2026-05-16T09:59:59.000Z"), now),
    false,
  );
  assert.equal(
    isEligibleUpcomingCancellation(new Date("2026-05-16T10:00:00.000Z"), now),
    false,
  );
});

test("Spot release helper only releases a reserved spot with no other active booking blocks", async () => {
  const { shouldReleaseReservedSpotAfterBookingStatusChange } = await loadBookingDomain();

  assert.equal(
    shouldReleaseReservedSpotAfterBookingStatusChange({
      spotStatus: "reserved",
      hasOtherActiveBlockingBookings: false,
    }),
    true,
  );
  assert.equal(
    shouldReleaseReservedSpotAfterBookingStatusChange({
      spotStatus: "reserved",
      hasOtherActiveBlockingBookings: true,
    }),
    false,
  );
  assert.equal(
    shouldReleaseReservedSpotAfterBookingStatusChange({
      spotStatus: "occupied",
      hasOtherActiveBlockingBookings: false,
    }),
    false,
  );
  assert.equal(
    shouldReleaseReservedSpotAfterBookingStatusChange({
      spotStatus: "maintenanceRequired",
      hasOtherActiveBlockingBookings: false,
    }),
    false,
  );
  assert.equal(
    shouldReleaseReservedSpotAfterBookingStatusChange({
      spotStatus: "available",
      hasOtherActiveBlockingBookings: false,
    }),
    false,
  );
});
