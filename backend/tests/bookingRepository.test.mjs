import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const driverA = {
  name: "Booking Repository Driver A",
  email: "booking-repo-driver-a@example.test",
  universityId: "BOOKREPOA001",
};

const driverB = {
  name: "Booking Repository Driver B",
  email: "booking-repo-driver-b@example.test",
  universityId: "BOOKREPOB001",
};

const zoneName = "Booking Repository Zone";

async function cleanup() {
  await prisma.parkingZone.deleteMany({
    where: { name: zoneName },
  });

  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: driverA.email },
        { universityId: driverA.universityId },
        { email: driverB.email },
        { universityId: driverB.universityId },
      ],
    },
  });
}

async function createRepository() {
  const { BookingRepository } = await import("../dist/repositories/bookingRepository.js");
  return new BookingRepository(prisma);
}

async function seedUsersAndSpots() {
  const userA = await prisma.user.create({
    data: {
      name: driverA.name,
      email: driverA.email,
      universityId: driverA.universityId,
      passwordHash: "booking-repo-password-hash-a",
      role: "driver",
      accountStatus: "active",
    },
  });

  const userB = await prisma.user.create({
    data: {
      name: driverB.name,
      email: driverB.email,
      universityId: driverB.universityId,
      passwordHash: "booking-repo-password-hash-b",
      role: "driver",
      accountStatus: "active",
    },
  });

  const zone = await prisma.parkingZone.create({
    data: {
      zoneCode: "BR",
      name: zoneName,
      capacity: 4,
      parkingSpots: {
        create: [
          { spotCode: "BR-001", status: "available", level: "Ground", rowLabel: "BR" },
          { spotCode: "BR-002", status: "available", level: "Ground", rowLabel: "BR" },
        ],
      },
    },
    include: { parkingSpots: true },
  });

  return {
    userA,
    userB,
    firstSpot: zone.parkingSpots[0],
    secondSpot: zone.parkingSpots[1],
    zone,
  };
}

test("BookingRepository creates a confirmed booking and reserves the spot", async () => {
  const repository = await createRepository();
  await cleanup();

  try {
    const { userA, firstSpot } = await seedUsersAndSpots();
    const startTime = new Date("2026-05-20T01:00:00.000Z");
    const endTime = new Date("2026-05-20T03:00:00.000Z");
    const expiresAt = new Date("2026-05-20T01:15:00.000Z");

    const result = await repository.createConfirmedBookingWithSpotReservation({
      userId: userA.id,
      spotId: firstSpot.id,
      startTime,
      endTime,
      expiresAt,
    });

    assert.equal(result.booking.status, "confirmed");
    assert.equal(result.booking.userId, userA.id);
    assert.equal(result.booking.spotId, firstSpot.id);
    assert.equal(result.booking.spot.zone.id, firstSpot.zoneId);
    assert.equal(result.parkingSpot.status, "reserved");
  } finally {
    await cleanup();
  }
});

test("BookingRepository finds overlapping active bookings and ignores terminal ones", async () => {
  const repository = await createRepository();
  await cleanup();

  try {
    const { userA, firstSpot } = await seedUsersAndSpots();
    const initial = await repository.createConfirmedBookingWithSpotReservation({
      userId: userA.id,
      spotId: firstSpot.id,
      startTime: new Date("2026-05-20T01:00:00.000Z"),
      endTime: new Date("2026-05-20T03:00:00.000Z"),
      expiresAt: new Date("2026-05-20T01:15:00.000Z"),
    });

    const overlap = await repository.findOverlappingActiveBooking(
      firstSpot.id,
      new Date("2026-05-20T02:00:00.000Z"),
      new Date("2026-05-20T04:00:00.000Z"),
    );
    assert.equal(overlap?.id, initial.booking.id);

    await repository.cancelBooking(initial.booking.id);

    const noOverlap = await repository.findOverlappingActiveBooking(
      firstSpot.id,
      new Date("2026-05-20T02:00:00.000Z"),
      new Date("2026-05-20T04:00:00.000Z"),
    );
    assert.equal(noOverlap, null);
  } finally {
    await cleanup();
  }
});

test("BookingRepository scopes list and detail access for a specific user", async () => {
  const repository = await createRepository();
  await cleanup();

  try {
    const { userA, userB, firstSpot, secondSpot } = await seedUsersAndSpots();

    const bookingA = await repository.createConfirmedBookingWithSpotReservation({
      userId: userA.id,
      spotId: firstSpot.id,
      startTime: new Date("2026-05-21T01:00:00.000Z"),
      endTime: new Date("2026-05-21T03:00:00.000Z"),
      expiresAt: new Date("2026-05-21T01:15:00.000Z"),
    });
    const bookingB = await repository.createConfirmedBookingWithSpotReservation({
      userId: userB.id,
      spotId: secondSpot.id,
      startTime: new Date("2026-05-22T01:00:00.000Z"),
      endTime: new Date("2026-05-22T03:00:00.000Z"),
      expiresAt: new Date("2026-05-22T01:15:00.000Z"),
    });

    const userABookings = await repository.listForUser(userA.id);
    assert.equal(userABookings.length, 1);
    assert.equal(userABookings[0].id, bookingA.booking.id);

    const canReadOwnBooking = await repository.findByIdForUser(bookingA.booking.id, userA.id);
    const cannotReadOtherBooking = await repository.findByIdForUser(bookingB.booking.id, userA.id);

    assert.equal(canReadOwnBooking?.id, bookingA.booking.id);
    assert.equal(cannotReadOtherBooking, null);
  } finally {
    await cleanup();
  }
});

test("BookingRepository admin listing supports filters and excludes sensitive fields", async () => {
  const repository = await createRepository();
  await cleanup();

  try {
    const { userA, userB, firstSpot, secondSpot, zone } = await seedUsersAndSpots();
    const bookingA = await repository.createConfirmedBookingWithSpotReservation({
      userId: userA.id,
      spotId: firstSpot.id,
      startTime: new Date("2026-05-23T01:00:00.000Z"),
      endTime: new Date("2026-05-23T03:00:00.000Z"),
      expiresAt: new Date("2026-05-23T01:15:00.000Z"),
    });
    const bookingB = await repository.createConfirmedBookingWithSpotReservation({
      userId: userB.id,
      spotId: secondSpot.id,
      startTime: new Date("2026-05-24T01:00:00.000Z"),
      endTime: new Date("2026-05-24T03:00:00.000Z"),
      expiresAt: new Date("2026-05-24T01:15:00.000Z"),
    });

    await repository.cancelBooking(bookingB.booking.id);

    const filtered = await repository.listForAdmin({
      page: 1,
      pageSize: 20,
      status: "confirmed",
      userId: userA.id,
      zoneId: zone.id,
      from: new Date("2026-05-23T00:00:00.000Z"),
      to: new Date("2026-05-23T23:59:59.000Z"),
    });

    assert.equal(filtered.bookings.length, 1);
    assert.equal(filtered.pagination.page, 1);
    assert.equal(filtered.pagination.pageSize, 20);
    assert.equal(filtered.bookings[0].id, bookingA.booking.id);
    assert.equal(filtered.bookings[0].user.id, userA.id);
    assert.equal(Object.hasOwn(filtered.bookings[0].user, "universityId"), false);
    assert.equal(Object.hasOwn(filtered.bookings[0].user, "passwordHash"), false);
    assert.equal(Object.hasOwn(filtered.bookings[0].user, "licensePlate"), false);
    assert.equal(Object.hasOwn(filtered.bookings[0].user, "token"), false);
  } finally {
    await cleanup();
  }
});

test("BookingRepository tracks expirable bookings, active counts, and booking notifications", async () => {
  const repository = await createRepository();
  await cleanup();

  try {
    const { userA, firstSpot } = await seedUsersAndSpots();
    const dueBooking = await repository.createConfirmedBookingWithSpotReservation({
      userId: userA.id,
      spotId: firstSpot.id,
      startTime: new Date("2026-05-25T01:00:00.000Z"),
      endTime: new Date("2026-05-25T03:00:00.000Z"),
      expiresAt: new Date("2026-05-25T01:15:00.000Z"),
    });

    const activeCount = await repository.countActiveBlockingBookingsForSpot(firstSpot.id);
    assert.equal(activeCount, 1);

    const activeCountExcluding = await repository.countActiveBlockingBookingsForSpot(
      firstSpot.id,
      dueBooking.booking.id,
    );
    assert.equal(activeCountExcluding, 0);

    const dueBookings = await repository.findExpirableBookings(
      new Date("2026-05-25T01:20:00.000Z"),
    );
    assert.equal(
      dueBookings.some((booking) => booking.id === dueBooking.booking.id),
      true,
    );

    const expired = await repository.expireBooking(dueBooking.booking.id);
    assert.equal(expired.status, "expired");

    const notification = await repository.createBookingNotification({
      userId: userA.id,
      bookingId: dueBooking.booking.id,
      type: "bookingConfirmation",
      title: "Booking confirmed",
      message: "Your booking has been confirmed.",
      status: "sent",
      sentAt: new Date("2026-05-25T01:00:00.000Z"),
    });
    assert.equal(notification.type, "bookingConfirmation");
    assert.equal(notification.bookingId, dueBooking.booking.id);
    assert.equal(notification.status, "sent");
  } finally {
    await cleanup();
  }
});

test("BookingRepository admin listing paginates with backend userSearch and zoneName filters", async () => {
  const repository = await createRepository();
  await cleanup();

  try {
    const { userA, firstSpot, secondSpot, zone } = await seedUsersAndSpots();
    for (let index = 0; index < 3; index += 1) {
      await repository.createConfirmedBookingWithSpotReservation({
        userId: userA.id,
        spotId: index % 2 === 0 ? firstSpot.id : secondSpot.id,
        startTime: new Date(`2026-05-2${index + 6}T01:00:00.000Z`),
        endTime: new Date(`2026-05-2${index + 6}T03:00:00.000Z`),
        expiresAt: new Date(`2026-05-2${index + 6}T01:15:00.000Z`),
      });
    }

    const firstPage = await repository.listForAdmin({
      page: 1,
      pageSize: 1,
      userSearch: "driver a",
      zoneName: zone.name,
    });
    const secondPage = await repository.listForAdmin({
      page: 2,
      pageSize: 1,
      userSearch: "driver a",
      zoneName: zone.name,
    });

    assert.equal(firstPage.pagination.page, 1);
    assert.equal(secondPage.pagination.page, 2);
    assert.equal(firstPage.pagination.pageSize, 1);
    assert.equal(firstPage.pagination.total >= 1, true);
    assert.equal(firstPage.bookings.length, 1);
    assert.equal(secondPage.bookings.length, 1);
  } finally {
    await cleanup();
  }
});

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});
