import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const prefix = "schema-test";

const ids = {
  user: `${prefix}-user`,
  vehicle: `${prefix}-vehicle`,
  subscription: `${prefix}-subscription`,
  zone: `${prefix}-zone`,
  spot: `${prefix}-spot`,
  booking: `${prefix}-booking`,
  detectionEvent: `${prefix}-detection-event`,
  occupancyHistory: `${prefix}-occupancy-history`,
  notification: `${prefix}-notification`,
  incidentReport: `${prefix}-incident-report`,
};

const startTime = new Date("2026-05-15T01:00:00.000Z");
const endTime = new Date("2026-05-15T03:00:00.000Z");

async function cleanup() {
  await prisma.incidentReport.deleteMany({ where: { id: ids.incidentReport } });
  await prisma.notification.deleteMany({ where: { id: ids.notification } });
  await prisma.occupancyHistory.deleteMany({ where: { id: ids.occupancyHistory } });
  await prisma.detectionEvent.deleteMany({ where: { id: ids.detectionEvent } });
  await prisma.booking.deleteMany({ where: { id: ids.booking } });
  await prisma.parkingSpot.deleteMany({ where: { id: ids.spot } });
  await prisma.parkingZone.deleteMany({ where: { id: ids.zone } });
  await prisma.subscription.deleteMany({ where: { id: ids.subscription } });
  await prisma.vehicleProfile.deleteMany({ where: { id: ids.vehicle } });
  await prisma.user.deleteMany({ where: { id: ids.user } });
}

async function createFixture() {
  await prisma.user.create({
    data: {
      id: ids.user,
      name: "Schema Test Driver",
      email: "schema-test-driver@example.test",
      universityId: "SCHEMA001",
      passwordHash: "schema-test-password-hash",
      role: "driver",
      accountStatus: "active",
      vehicleProfiles: {
        create: {
          id: ids.vehicle,
          licensePlate: "SCHEMA-001",
          vehicleMake: "Toyota",
          vehicleModel: "Corolla",
          vehicleColor: "White",
          isPrimary: true,
        },
      },
      subscriptions: {
        create: {
          id: ids.subscription,
          type: "monthly",
          status: "active",
          startTime,
          endTime: new Date("2026-06-15T03:00:00.000Z"),
        },
      },
    },
  });

  await prisma.parkingZone.create({
    data: {
      id: ids.zone,
      name: "Schema Test Zone",
      description: "Zone used by schema verification tests.",
      capacity: 1,
      distanceFromEntryMeters: 100,
      displayOrder: 99,
      parkingSpots: {
        create: {
          id: ids.spot,
          spotCode: "T-001",
          status: "available",
          level: "Ground",
          rowLabel: "T",
        },
      },
    },
  });

  await prisma.booking.create({
    data: {
      id: ids.booking,
      userId: ids.user,
      spotId: ids.spot,
      status: "confirmed",
      startTime,
      endTime,
      expiresAt: new Date("2026-05-15T01:15:00.000Z"),
    },
  });

  await prisma.detectionEvent.create({
    data: {
      id: ids.detectionEvent,
      spotId: ids.spot,
      type: "vehicleEntry",
      occurredAt: startTime,
      rawPayload: { source: "schema-test", signal: "vehicleEntry" },
    },
  });

  await prisma.occupancyHistory.create({
    data: {
      id: ids.occupancyHistory,
      zoneId: ids.zone,
      recordedAt: startTime,
      capacity: 1,
      availableSpots: 0,
      occupiedSpots: 1,
      reservedSpots: 0,
      occupancyRate: "100.00",
    },
  });

  await prisma.notification.create({
    data: {
      id: ids.notification,
      userId: ids.user,
      bookingId: ids.booking,
      type: "bookingConfirmation",
      status: "sent",
      title: "Booking confirmed",
      message: "Your schema test booking is confirmed.",
      sentAt: startTime,
    },
  });

  await prisma.incidentReport.create({
    data: {
      id: ids.incidentReport,
      userId: ids.user,
      spotId: ids.spot,
      status: "open",
      issueType: "spotDiscrepancy",
      description: "Schema test incident report.",
    },
  });
}

test("Prisma schema supports MVP relationships", async (t) => {
  await cleanup();
  await createFixture();

  try {
    await t.test("user has related vehicle profiles", async () => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: ids.user },
        include: { vehicleProfiles: true },
      });

      assert.equal(user.vehicleProfiles.length, 1);
      assert.equal(user.vehicleProfiles[0].licensePlate, "SCHEMA-001");
    });

    await t.test("user has related subscriptions", async () => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: ids.user },
        include: { subscriptions: true },
      });

      assert.equal(user.subscriptions.length, 1);
      assert.equal(user.subscriptions[0].type, "monthly");
    });

    await t.test("parking zone has related parking spots", async () => {
      const zone = await prisma.parkingZone.findUniqueOrThrow({
        where: { id: ids.zone },
        include: { parkingSpots: true },
      });

      assert.equal(zone.parkingSpots.length, 1);
      assert.equal(zone.parkingSpots[0].spotCode, "T-001");
    });

    await t.test("booking links to user and parking spot", async () => {
      const booking = await prisma.booking.findUniqueOrThrow({
        where: { id: ids.booking },
        include: { user: true, spot: true },
      });

      assert.equal(booking.user.id, ids.user);
      assert.equal(booking.spot.id, ids.spot);
      assert.equal(booking.status, "confirmed");
    });

    await t.test("detection event links to parking spot", async () => {
      const detectionEvent = await prisma.detectionEvent.findUniqueOrThrow({
        where: { id: ids.detectionEvent },
        include: { spot: true },
      });

      assert.equal(detectionEvent.spot.id, ids.spot);
      assert.equal(detectionEvent.type, "vehicleEntry");
    });

    await t.test("occupancy history links to parking zone", async () => {
      const occupancyHistory = await prisma.occupancyHistory.findUniqueOrThrow({
        where: { id: ids.occupancyHistory },
        include: { zone: true },
      });

      assert.equal(occupancyHistory.zone.id, ids.zone);
      assert.equal(occupancyHistory.capacity, 1);
    });

    await t.test("notification links to user and optional booking", async () => {
      const notification = await prisma.notification.findUniqueOrThrow({
        where: { id: ids.notification },
        include: { user: true, booking: true },
      });

      assert.equal(notification.user.id, ids.user);
      assert.equal(notification.booking?.id, ids.booking);
      assert.equal(notification.type, "bookingConfirmation");
    });

    await t.test("incident report links to user and optional parking spot", async () => {
      const incidentReport = await prisma.incidentReport.findUniqueOrThrow({
        where: { id: ids.incidentReport },
        include: { user: true, spot: true },
      });

      assert.equal(incidentReport.user.id, ids.user);
      assert.equal(incidentReport.spot?.id, ids.spot);
      assert.equal(incidentReport.status, "open");
    });
  } finally {
    await cleanup();
  }
});

test.after(async () => {
  await prisma.$disconnect();
});
