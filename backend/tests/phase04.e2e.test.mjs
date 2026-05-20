import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

process.env.AUTH_TOKEN_SECRET = "phase-04-e2e-test-secret";
process.env.AUTH_TOKEN_EXPIRES_IN = "1h";

const prisma = new PrismaClient();

const adminUser = {
  name: "Phase Four Admin",
  universityId: "PHASE04ADMIN001",
  email: "phase04-admin@example.test",
  password: "phase-04-admin-password",
};

const driverOne = {
  name: "Phase Four Driver One",
  universityId: "UOW001",
  email: "phase04-driver1@example.test",
  password: "phase-04-driver1-password",
};

const driverTwo = {
  name: "Phase Four Driver Two",
  universityId: "UOW002",
  email: "phase04-driver2@example.test",
  password: "phase-04-driver2-password",
};

const phase04ZoneName = "Phase 04 E2E Zone";

async function cleanup() {
  await prisma.notification.deleteMany({
    where: {
      OR: [
        { user: { email: { in: [adminUser.email, driverOne.email, driverTwo.email] } } },
        { booking: { spot: { zone: { name: phase04ZoneName } } } },
      ],
    },
  });
  await prisma.booking.deleteMany({
    where: { spot: { zone: { name: phase04ZoneName } } },
  });
  await prisma.occupancyHistory.deleteMany({
    where: { zone: { name: phase04ZoneName } },
  });
  await prisma.detectionEvent.deleteMany({
    where: { spot: { zone: { name: phase04ZoneName } } },
  });
  await prisma.parkingSpot.deleteMany({
    where: { zone: { name: phase04ZoneName } },
  });
  await prisma.parkingZone.deleteMany({
    where: { name: phase04ZoneName },
  });
  await prisma.subscription.deleteMany({
    where: {
      user: { email: { in: [adminUser.email, driverOne.email, driverTwo.email] } },
    },
  });
  await prisma.vehicleProfile.deleteMany({
    where: {
      user: { email: { in: [adminUser.email, driverOne.email, driverTwo.email] } },
    },
  });
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: adminUser.email },
        { email: driverOne.email },
        { email: driverTwo.email },
      ],
    },
  });
}

async function seedBaseData() {
  await cleanup();

  const [admin, driverA, driverB] = await Promise.all([
    prisma.user.create({
      data: {
        name: adminUser.name,
        email: adminUser.email,
        universityId: adminUser.universityId,
        passwordHash: await bcrypt.hash(adminUser.password, 12),
        role: "admin",
        accountStatus: "active",
      },
    }),
    prisma.user.create({
      data: {
        name: driverOne.name,
        email: driverOne.email,
        universityId: driverOne.universityId,
        passwordHash: await bcrypt.hash(driverOne.password, 12),
        role: "driver",
        accountStatus: "active",
      },
    }),
    prisma.user.create({
      data: {
        name: driverTwo.name,
        email: driverTwo.email,
        universityId: driverTwo.universityId,
        passwordHash: await bcrypt.hash(driverTwo.password, 12),
        role: "driver",
        accountStatus: "active",
      },
    }),
  ]);

  await prisma.vehicleProfile.createMany({
    data: [
      { userId: driverA.id, licensePlate: "P4E2E-101", isPrimary: true },
      { userId: driverB.id, licensePlate: "P4E2E-202", isPrimary: true },
    ],
  });

  const now = new Date();
  await prisma.subscription.create({
    data: {
      userId: driverA.id,
      type: "monthly",
      status: "active",
      startTime: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const zone = await prisma.parkingZone.create({
    data: {
      zoneCode: "PFE",
      name: phase04ZoneName,
      description: "Phase 04 e2e validation zone",
      capacity: 10,
      distanceFromEntryMeters: 90,
      displayOrder: 404,
    },
  });

  const [availableSpot, occupiedSpot, maintenanceSpot] = await Promise.all([
    prisma.parkingSpot.create({
      data: { zoneId: zone.id, spotCode: "P4-AVAILABLE", status: "available" },
    }),
    prisma.parkingSpot.create({
      data: { zoneId: zone.id, spotCode: "P4-OCCUPIED", status: "occupied" },
    }),
    prisma.parkingSpot.create({
      data: { zoneId: zone.id, spotCode: "P4-MAINT", status: "maintenanceRequired" },
    }),
  ]);

  return { admin, driverA, driverB, zone, availableSpot, occupiedSpot, maintenanceSpot };
}

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1");
    server.once("listening", () => resolve(server));
    server.once("error", reject);
  });
}

async function close(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const body = text ? parseBody(text) : null;
  return { statusCode: response.status, body };
}

function parseBody(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function createApp() {
  const { createApp } = await import("../dist/index.js");
  return createApp();
}

async function login(baseUrl, email, password) {
  return request(baseUrl, "/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

function authHeaders(token) {
  return { authorization: `Bearer ${token}` };
}

test("Phase 04 end-to-end booking and reservation workflow works", async () => {
  const app = await createApp();
  const seeded = await seedBaseData();
  const server = await listen(app);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const health = await request(baseUrl, "/health");
    assert.equal(health.statusCode, 200);
    assert.equal(health.body.status, "ok");

    const adminLogin = await login(baseUrl, adminUser.email, adminUser.password);
    const driverOneLogin = await login(baseUrl, driverOne.email, driverOne.password);
    const driverTwoLogin = await login(baseUrl, driverTwo.email, driverTwo.password);
    assert.equal(adminLogin.statusCode, 200);
    assert.equal(driverOneLogin.statusCode, 200);
    assert.equal(driverTwoLogin.statusCode, 200);
    const adminToken = adminLogin.body.token;
    const driverOneToken = driverOneLogin.body.token;
    const driverTwoToken = driverTwoLogin.body.token;

    const now = new Date();
    const startTime = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();

    const created = await request(baseUrl, "/api/bookings", {
      method: "POST",
      headers: authHeaders(driverOneToken),
      body: {
        spotId: seeded.availableSpot.id,
        startTime,
        endTime,
      },
    });
    assert.equal(created.statusCode, 201);
    assert.equal(created.body.booking.status, "confirmed");
    assert.equal(created.body.parkingSpot.status, "reserved");
    const bookingId = created.body.booking.id;

    const overlap = await request(baseUrl, "/api/bookings", {
      method: "POST",
      headers: authHeaders(driverOneToken),
      body: {
        spotId: seeded.availableSpot.id,
        startTime,
        endTime,
      },
    });
    assert.equal(overlap.statusCode, 409);

    const maintenanceAttempt = await request(baseUrl, "/api/bookings", {
      method: "POST",
      headers: authHeaders(driverOneToken),
      body: {
        spotId: seeded.maintenanceSpot.id,
        startTime,
        endTime,
      },
    });
    assert.equal(maintenanceAttempt.statusCode, 409);

    const immediateOccupiedAttempt = await request(baseUrl, "/api/bookings", {
      method: "POST",
      headers: authHeaders(driverOneToken),
      body: {
        spotId: seeded.occupiedSpot.id,
        startTime: new Date(now.getTime() + 2 * 60 * 1000).toISOString(),
        endTime: new Date(now.getTime() + 62 * 60 * 1000).toISOString(),
      },
    });
    assert.equal(immediateOccupiedAttempt.statusCode, 409);

    const mine = await request(baseUrl, "/api/bookings/me", {
      headers: authHeaders(driverOneToken),
    });
    assert.equal(mine.statusCode, 200);
    assert.ok(mine.body.bookings.some((booking) => booking.id === bookingId));

    const notOwnerView = await request(baseUrl, `/api/bookings/${bookingId}`, {
      headers: authHeaders(driverTwoToken),
    });
    assert.equal(notOwnerView.statusCode, 404);

    const notOwnerCancel = await request(baseUrl, `/api/bookings/${bookingId}/cancel`, {
      method: "POST",
      headers: authHeaders(driverTwoToken),
    });
    assert.equal(notOwnerCancel.statusCode, 404);

    const cancelled = await request(baseUrl, `/api/bookings/${bookingId}/cancel`, {
      method: "POST",
      headers: authHeaders(driverOneToken),
    });
    assert.equal(cancelled.statusCode, 200);
    assert.equal(cancelled.body.booking.status, "cancelled");

    const confirmationNotification = await prisma.notification.findFirst({
      where: { bookingId, type: "bookingConfirmation" },
    });
    assert.ok(confirmationNotification);

    const driverAdminAttempt = await request(baseUrl, "/api/admin/bookings", {
      headers: authHeaders(driverOneToken),
    });
    assert.equal(driverAdminAttempt.statusCode, 403);

    const adminList = await request(baseUrl, "/api/admin/bookings?status=cancelled", {
      headers: authHeaders(adminToken),
    });
    assert.equal(adminList.statusCode, 200);
    assert.ok(adminList.body.bookings.some((booking) => booking.id === bookingId));
    const adminBooking = adminList.body.bookings.find((booking) => booking.id === bookingId);
    assert.equal(Object.hasOwn(adminBooking.user, "passwordHash"), false);
    assert.equal(Object.hasOwn(adminBooking.user, "universityId"), false);

    const adminFilterByUser = await request(
      baseUrl,
      `/api/admin/bookings?userId=${encodeURIComponent(seeded.driverA.id)}`,
      { headers: authHeaders(adminToken) },
    );
    assert.equal(adminFilterByUser.statusCode, 200);
    assert.ok(adminFilterByUser.body.bookings.every((booking) => booking.userId === seeded.driverA.id));

    const expirableBooking = await prisma.booking.create({
      data: {
        userId: seeded.driverA.id,
        spotId: seeded.availableSpot.id,
        status: "confirmed",
        startTime: new Date(now.getTime() - 60 * 60 * 1000),
        endTime: new Date(now.getTime() + 30 * 60 * 1000),
        expiresAt: new Date(now.getTime() - 5 * 60 * 1000),
      },
    });
    await prisma.parkingSpot.update({
      where: { id: seeded.availableSpot.id },
      data: { status: "reserved" },
    });

    const { BookingExpirationService } = await import(
      "../dist/services/bookingExpirationService.js"
    );
    const expiration = await new BookingExpirationService().expireDueBookings(now);
    assert.ok(expiration.expired >= 1);

    const expiredBookingRecord = await prisma.booking.findUnique({
      where: { id: expirableBooking.id },
    });
    assert.equal(expiredBookingRecord.status, "expired");

    const reminderBooking = await prisma.booking.create({
      data: {
        userId: seeded.driverA.id,
        spotId: seeded.occupiedSpot.id,
        status: "confirmed",
        startTime: new Date(now.getTime() + 10 * 60 * 1000),
        endTime: new Date(now.getTime() + 70 * 60 * 1000),
        expiresAt: new Date(now.getTime() + 25 * 60 * 1000),
      },
    });
    const { BookingNotificationService } = await import(
      "../dist/services/bookingNotificationService.js"
    );
    const reminderResult = await new BookingNotificationService().createDueBookingReminders(now);
    assert.ok(reminderResult.created >= 1);

    const reminderNotification = await prisma.notification.findFirst({
      where: { bookingId: reminderBooking.id, type: "bookingReminder" },
    });
    assert.ok(reminderNotification);

    const adminByZone = await request(
      baseUrl,
      `/api/admin/bookings?zoneId=${encodeURIComponent(seeded.zone.id)}`,
      { headers: authHeaders(adminToken) },
    );
    assert.equal(adminByZone.statusCode, 200);
    assert.ok(
      adminByZone.body.bookings.every((booking) => booking.spot.zone.id === seeded.zone.id),
    );
  } finally {
    await close(server);
    await cleanup();
  }
});

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});
