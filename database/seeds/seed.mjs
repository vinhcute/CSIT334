import { createRequire } from "node:module";

const requireFromBackend = createRequire(new URL("../../backend/package.json", import.meta.url));
const { PrismaClient } = requireFromBackend("@prisma/client");

const prisma = new PrismaClient();

const baseDate = new Date("2026-05-01T00:00:00.000Z");

const addHours = (date, hours) => new Date(date.getTime() + hours * 60 * 60 * 1000);
const pad = (value) => String(value).padStart(3, "0");

const zones = [
  {
    id: "zone-north-lot",
    zoneCode: "N",
    name: "North Lot",
    description: "Primary student parking near the north campus entrance.",
    capacity: 20,
    distanceFromEntryMeters: 120,
    displayOrder: 1,
  },
  {
    id: "zone-engineering-building",
    zoneCode: "B",
    name: "Engineering Building",
    description: "Parking zone closest to engineering labs and lecture rooms.",
    capacity: 20,
    distanceFromEntryMeters: 180,
    displayOrder: 2,
  },
  {
    id: "zone-library-deck",
    zoneCode: "L",
    name: "Library Deck",
    description: "Central parking zone near the library and student services.",
    capacity: 20,
    distanceFromEntryMeters: 260,
    displayOrder: 3,
  },
  {
    id: "zone-south-campus",
    zoneCode: "S",
    name: "South Campus",
    description: "Mixed student and staff parking near the south buildings.",
    capacity: 20,
    distanceFromEntryMeters: 340,
    displayOrder: 4,
  },
  {
    id: "zone-sports-centre",
    zoneCode: "SC",
    name: "Sports Centre",
    description: "Parking zone near the sports centre and recreation fields.",
    capacity: 20,
    distanceFromEntryMeters: 420,
    displayOrder: 5,
  },
];

const users = [
  {
    id: "user-admin-001",
    name: "Campus Parking Admin",
    email: "admin001@example.test",
    universityId: "ADM001",
    passwordHash: "demo-password-hash-admin-001",
    role: "admin",
    accountStatus: "active",
  },
  ...Array.from({ length: 100 }, (_, index) => {
    const number = index + 1;
    return {
      id: `user-driver-${pad(number)}`,
      name: `Demo Driver ${pad(number)}`,
      email: `driver${pad(number)}@example.test`,
      universityId: `UOW${pad(number)}`,
      passwordHash: `demo-password-hash-driver-${pad(number)}`,
      role: "driver",
      accountStatus: number % 25 === 0 ? "disabled" : "active",
    };
  }),
];

const vehicleProfiles = Array.from({ length: 100 }, (_, index) => {
  const number = index + 1;
  return {
    id: `vehicle-${pad(number)}`,
    userId: `user-driver-${pad(number)}`,
    licensePlate: `UOW-${pad(number)}`,
    vehicleMake: ["Toyota", "Mazda", "Hyundai", "Kia"][index % 4],
    vehicleModel: ["Corolla", "CX-5", "i30", "Cerato"][index % 4],
    vehicleColor: ["White", "Silver", "Blue", "Black"][index % 4],
    isPrimary: true,
  };
});

const subscriptions = Array.from({ length: 100 }, (_, index) => {
  const number = index + 1;
  const type = ["daily", "weekly", "monthly"][index % 3];
  return {
    id: `subscription-${pad(number)}`,
    userId: `user-driver-${pad(number)}`,
    type,
    status: number % 20 === 0 ? "expired" : "active",
    startTime: addHours(baseDate, -24 * (index % 10)),
    endTime: addHours(baseDate, 24 * ((index % 30) + 1)),
  };
});

const parkingSpots = zones.flatMap((zone, zoneIndex) =>
  Array.from({ length: 20 }, (_, spotIndex) => {
    const globalIndex = zoneIndex * 20 + spotIndex + 1;
    return {
      id: `spot-${pad(globalIndex)}`,
      zoneId: zone.id,
      spotCode: `${zone.zoneCode}-${pad(spotIndex + 1)}`,
      status: ["available", "occupied", "reserved", "maintenanceRequired"][globalIndex % 4],
      level: zoneIndex < 2 ? "Ground" : "Level 1",
      rowLabel: String.fromCharCode(65 + zoneIndex),
    };
  }),
);

const bookings = Array.from({ length: 100 }, (_, index) => {
  const number = index + 1;
  const startTime = addHours(baseDate, index * 2);
  const status = ["pending", "confirmed", "cancelled", "expired", "completed"][index % 5];
  return {
    id: `booking-${pad(number)}`,
    userId: `user-driver-${pad(((index % 100) + 1))}`,
    spotId: `spot-${pad(((index % 100) + 1))}`,
    status,
    startTime,
    endTime: addHours(startTime, 2),
    expiresAt: status === "pending" || status === "confirmed" ? addHours(startTime, 0.25) : null,
  };
});

const detectionEvents = Array.from({ length: 100 }, (_, index) => {
  const number = index + 1;
  const type = index % 2 === 0 ? "vehicleEntry" : "vehicleExit";
  return {
    id: `detection-${pad(number)}`,
    spotId: `spot-${pad(((index % 100) + 1))}`,
    type,
    occurredAt: addHours(baseDate, index),
    rawPayload: {
      source: "seeded-sensor-feed",
      sequence: number,
      signal: type,
    },
  };
});

const occupancyHistory = zones.flatMap((zone, zoneIndex) =>
  Array.from({ length: 24 }, (_, hourIndex) => {
    const occupiedSpots = (zoneIndex * 3 + hourIndex * 2) % (zone.capacity + 1);
    const reservedSpots = hourIndex % 4;
    const availableSpots = Math.max(zone.capacity - occupiedSpots - reservedSpots, 0);
    const occupancyRate = (((occupiedSpots + reservedSpots) / zone.capacity) * 100).toFixed(2);
    return {
      id: `occupancy-${zoneIndex + 1}-${pad(hourIndex + 1)}`,
      zoneId: zone.id,
      recordedAt: addHours(baseDate, hourIndex),
      capacity: zone.capacity,
      availableSpots,
      occupiedSpots,
      reservedSpots,
      occupancyRate,
    };
  }),
);

const notifications = Array.from({ length: 100 }, (_, index) => {
  const number = index + 1;
  const type = ["bookingConfirmation", "bookingReminder", "accountStatus"][index % 3];
  return {
    id: `notification-${pad(number)}`,
    userId: `user-driver-${pad(((index % 100) + 1))}`,
    bookingId: type === "accountStatus" ? null : `booking-${pad(((index % 100) + 1))}`,
    type,
    status: ["pending", "sent", "read"][index % 3],
    title: `Demo ${type} ${pad(number)}`,
    message: `Seeded ${type} notification ${pad(number)} for the Smart Parking demo.`,
    sentAt: index % 3 === 0 ? null : addHours(baseDate, index),
    readAt: index % 3 === 2 ? addHours(baseDate, index + 1) : null,
  };
});

const incidentReports = Array.from({ length: 100 }, (_, index) => {
  const number = index + 1;
  const status = ["open", "inReview", "resolved"][index % 3];
  return {
    id: `incident-${pad(number)}`,
    userId: `user-driver-${pad(((index % 100) + 1))}`,
    spotId: index % 5 === 0 ? null : `spot-${pad(((index % 100) + 1))}`,
    status,
    issueType: index % 2 === 0 ? "spotDiscrepancy" : "parkingIssue",
    description: `Seeded incident report ${pad(number)} for demo verification.`,
    resolution: status === "resolved" ? `Resolved seeded report ${pad(number)}.` : null,
    resolvedAt: status === "resolved" ? addHours(baseDate, index + 2) : null,
  };
});

async function clearData() {
  await prisma.incidentReport.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.occupancyHistory.deleteMany();
  await prisma.detectionEvent.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.parkingSpot.deleteMany();
  await prisma.parkingZone.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.vehicleProfile.deleteMany();
  await prisma.user.deleteMany();
}

async function seedData() {
  await prisma.user.createMany({ data: users });
  await prisma.vehicleProfile.createMany({ data: vehicleProfiles });
  await prisma.subscription.createMany({ data: subscriptions });
  await prisma.parkingZone.createMany({ data: zones });
  await prisma.parkingSpot.createMany({ data: parkingSpots });
  await prisma.booking.createMany({ data: bookings });
  await prisma.detectionEvent.createMany({ data: detectionEvents });
  await prisma.occupancyHistory.createMany({ data: occupancyHistory });
  await prisma.notification.createMany({ data: notifications });
  await prisma.incidentReport.createMany({ data: incidentReports });
}

async function printSummary() {
  const counts = {
    users: await prisma.user.count(),
    vehicleProfiles: await prisma.vehicleProfile.count(),
    subscriptions: await prisma.subscription.count(),
    parkingZones: await prisma.parkingZone.count(),
    parkingSpots: await prisma.parkingSpot.count(),
    bookings: await prisma.booking.count(),
    detectionEvents: await prisma.detectionEvent.count(),
    occupancyHistory: await prisma.occupancyHistory.count(),
    notifications: await prisma.notification.count(),
    incidentReports: await prisma.incidentReport.count(),
  };

  console.table(counts);
}

try {
  await clearData();
  await seedData();
  await printSummary();
} finally {
  await prisma.$disconnect();
}
