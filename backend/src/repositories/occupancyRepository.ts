import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/database.js";

const zoneWithSpotsSelect = Prisma.validator<Prisma.ParkingZoneSelect>()({
  id: true,
  name: true,
  description: true,
  capacity: true,
  distanceFromEntryMeters: true,
  displayOrder: true,
  createdAt: true,
  updatedAt: true,
  parkingSpots: {
    orderBy: [{ spotCode: "asc" }],
    select: {
      id: true,
      zoneId: true,
      spotCode: true,
      status: true,
      level: true,
      rowLabel: true,
      createdAt: true,
      updatedAt: true,
    },
  },
});

export type OccupancyZoneWithSpots = Prisma.ParkingZoneGetPayload<{
  select: typeof zoneWithSpotsSelect;
}>;

const occupancyHistorySelect = {
  id: true,
  zoneId: true,
  recordedAt: true,
  capacity: true,
  availableSpots: true,
  occupiedSpots: true,
  reservedSpots: true,
  occupancyRate: true,
  createdAt: true,
} as const;

export interface CreateOccupancyHistoryRecordInput {
  zoneId: string;
  recordedAt: Date;
  capacity: number;
  availableSpots: number;
  occupiedSpots: number;
  reservedSpots: number;
  occupancyRate: string;
}

export class OccupancyRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async listZonesWithSpots() {
    return this.prisma.parkingZone.findMany({
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: zoneWithSpotsSelect,
    });
  }

  async findZoneWithSpots(zoneId: string) {
    return this.prisma.parkingZone.findUnique({
      where: { id: zoneId },
      select: zoneWithSpotsSelect,
    });
  }

  async createHistory(input: CreateOccupancyHistoryRecordInput) {
    return this.prisma.occupancyHistory.create({
      data: input,
      select: occupancyHistorySelect,
    });
  }
}
