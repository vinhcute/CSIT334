import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const testZoneNames = [
  "Inventory Rules Zone A",
  "Inventory Rules Zone B",
  "Inventory Rules Manual Zone",
];

async function cleanup() {
  await prisma.parkingZone.deleteMany({
    where: {
      name: { in: testZoneNames },
    },
  });
}

async function createServices() {
  const { ParkingSpotRepository } = await import("../dist/repositories/parkingSpotRepository.js");
  const { ParkingZoneRepository } = await import("../dist/repositories/parkingZoneRepository.js");
  const { ParkingSpotService } = await import("../dist/services/parkingSpotService.js");
  const { ParkingZoneService } = await import("../dist/services/parkingZoneService.js");

  const parkingSpotRepository = new ParkingSpotRepository(prisma);
  const parkingZoneRepository = new ParkingZoneRepository(prisma);

  return {
    parkingSpotService: new ParkingSpotService(
      parkingSpotRepository,
      parkingZoneRepository,
    ),
    parkingZoneService: new ParkingZoneService(
      parkingZoneRepository,
      parkingSpotRepository,
    ),
  };
}

test("Parking inventory rules prevent creating more spots than zone capacity", async () => {
  const {
    ParkingSpotCapacityConflictError,
  } = await import("../dist/services/parkingSpotService.js");
  const { parkingSpotService, parkingZoneService } = await createServices();
  await cleanup();

  try {
    const zone = await parkingZoneService.createZone({
      name: "Inventory Rules Zone A",
      capacity: 1,
    });
    await parkingSpotService.createSpot({
      zoneId: zone.id,
      spotCode: "A-001",
      status: "available",
    });

    await assert.rejects(
      () =>
        parkingSpotService.createSpot({
          zoneId: zone.id,
          spotCode: "A-002",
          status: "available",
        }),
      (error) => error instanceof ParkingSpotCapacityConflictError,
    );
  } finally {
    await cleanup();
  }
});

test("Parking inventory rules allow creating a spot below zone capacity", async () => {
  const { parkingSpotService, parkingZoneService } = await createServices();
  await cleanup();

  try {
    const zone = await parkingZoneService.createZone({
      name: "Inventory Rules Zone A",
      capacity: 2,
    });
    const spot = await parkingSpotService.createSpot({
      zoneId: zone.id,
      spotCode: "A-001",
      status: "available",
    });

    assert.equal(spot.zoneId, zone.id);
    assert.equal(spot.spotCode, "A-001");
  } finally {
    await cleanup();
  }
});

test("Parking inventory rules prevent moving a spot into a full zone", async () => {
  const {
    ParkingSpotCapacityConflictError,
  } = await import("../dist/services/parkingSpotService.js");
  const { parkingSpotService, parkingZoneService } = await createServices();
  await cleanup();

  try {
    const fullZone = await parkingZoneService.createZone({
      name: "Inventory Rules Zone A",
      capacity: 1,
    });
    const sourceZone = await parkingZoneService.createZone({
      name: "Inventory Rules Zone B",
      capacity: 2,
    });
    await parkingSpotService.createSpot({
      zoneId: fullZone.id,
      spotCode: "A-001",
      status: "available",
    });
    const sourceSpot = await parkingSpotService.createSpot({
      zoneId: sourceZone.id,
      spotCode: "B-001",
      status: "available",
    });

    await assert.rejects(
      () =>
        parkingSpotService.updateSpot(sourceSpot.id, {
          zoneId: fullZone.id,
          spotCode: "A-002",
        }),
      (error) => error instanceof ParkingSpotCapacityConflictError,
    );
  } finally {
    await cleanup();
  }
});

test("Parking inventory rules prevent reducing capacity below existing spot count", async () => {
  const {
    ParkingZoneCapacityConflictError,
  } = await import("../dist/services/parkingZoneService.js");
  const { parkingSpotService, parkingZoneService } = await createServices();
  await cleanup();

  try {
    const zone = await parkingZoneService.createZone({
      name: "Inventory Rules Zone A",
      capacity: 3,
    });
    await parkingSpotService.createSpot({
      zoneId: zone.id,
      spotCode: "A-001",
      status: "available",
    });
    await parkingSpotService.createSpot({
      zoneId: zone.id,
      spotCode: "A-002",
      status: "reserved",
    });

    await assert.rejects(
      () => parkingZoneService.updateZone(zone.id, { capacity: 1 }),
      (error) => error instanceof ParkingZoneCapacityConflictError,
    );

    const unchanged = await parkingZoneService.findZoneById(zone.id);
    assert.equal(unchanged.capacity, 3);
  } finally {
    await cleanup();
  }
});

test("Parking inventory rules allow increasing zone capacity", async () => {
  const { parkingSpotService, parkingZoneService } = await createServices();
  await cleanup();

  try {
    const zone = await parkingZoneService.createZone({
      name: "Inventory Rules Zone A",
      capacity: 1,
    });
    await parkingSpotService.createSpot({
      zoneId: zone.id,
      spotCode: "A-001",
      status: "available",
    });
    const updated = await parkingZoneService.updateZone(zone.id, { capacity: 3 });

    assert.equal(updated.capacity, 3);
  } finally {
    await cleanup();
  }
});

test("Parking inventory rules keep zone capacity manually managed", async () => {
  const { parkingSpotService, parkingZoneService } = await createServices();
  await cleanup();

  try {
    const zone = await parkingZoneService.createZone({
      name: "Inventory Rules Manual Zone",
      capacity: 2,
    });
    const spot = await parkingSpotService.createSpot({
      zoneId: zone.id,
      spotCode: "M-001",
      status: "available",
    });
    const afterCreate = await parkingZoneService.findZoneById(zone.id);

    await parkingSpotService.deleteSpot(spot.id);
    const afterDelete = await parkingZoneService.findZoneById(zone.id);

    assert.equal(afterCreate.capacity, 2);
    assert.equal(afterDelete.capacity, 2);
  } finally {
    await cleanup();
  }
});

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});
