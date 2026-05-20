import assert from "node:assert/strict";
import test from "node:test";

async function createService(overrides = {}) {
  const {
    BookingNotificationService,
  } = await import("../dist/services/bookingNotificationService.js");

  const createdNotifications = [];
  const bookingRepository = {
    createBookingNotification: async (input) => {
      createdNotifications.push(input);
      return { id: `notification-${createdNotifications.length}`, ...input };
    },
    findDueReminderBookings: async () => [
      {
        id: "booking-1",
        userId: "user-1",
        startTime: new Date("2026-05-15T00:20:00.000Z"),
        spot: {
          spotCode: "A-001",
          zone: { name: "Engineering Building" },
        },
      },
    ],
    findBookingNotificationByType: async () => null,
  };

  const repository = Object.assign(bookingRepository, overrides.bookingRepository);

  return {
    service: new BookingNotificationService(repository),
    createdNotifications,
  };
}

test("BookingNotificationService creates booking confirmation notifications", async () => {
  const { service, createdNotifications } = await createService();

  await service.createConfirmationNotification({
    id: "booking-1",
    userId: "user-1",
    startTime: new Date("2026-05-15T01:00:00.000Z"),
    spot: {
      spotCode: "A-001",
      zone: { name: "Engineering Building" },
    },
  });

  assert.equal(createdNotifications.length, 1);
  assert.equal(createdNotifications[0].type, "bookingConfirmation");
  assert.equal(createdNotifications[0].bookingId, "booking-1");
});

test("BookingNotificationService creates reminders for due bookings", async () => {
  const { service, createdNotifications } = await createService();
  const result = await service.createDueBookingReminders(
    new Date("2026-05-15T00:00:00.000Z"),
  );

  assert.equal(result.scanned, 1);
  assert.equal(result.created, 1);
  assert.equal(createdNotifications.length, 1);
  assert.equal(createdNotifications[0].type, "bookingReminder");
});

test("BookingNotificationService prevents duplicate reminders", async () => {
  const { service, createdNotifications } = await createService({
    bookingRepository: {
      findBookingNotificationByType: async () => ({
        id: "existing-reminder",
        bookingId: "booking-1",
        type: "bookingReminder",
      }),
    },
  });
  const result = await service.createDueBookingReminders(
    new Date("2026-05-15T00:00:00.000Z"),
  );

  assert.equal(result.scanned, 1);
  assert.equal(result.created, 0);
  assert.equal(createdNotifications.length, 0);
});
