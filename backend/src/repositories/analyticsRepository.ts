import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/database.js";

const analyticsHistorySelect = Prisma.validator<Prisma.OccupancyHistorySelect>()({
  id: true,
  zoneId: true,
  recordedAt: true,
  capacity: true,
  availableSpots: true,
  occupiedSpots: true,
  reservedSpots: true,
  occupancyRate: true,
  zone: {
    select: {
      id: true,
      name: true,
    },
  },
});

const analyticsZoneSelect = Prisma.validator<Prisma.ParkingZoneSelect>()({
  id: true,
  name: true,
  capacity: true,
  displayOrder: true,
  parkingSpots: {
    select: {
      id: true,
      status: true,
    },
  },
});

export type AnalyticsHistoryRecord = Prisma.OccupancyHistoryGetPayload<{
  select: typeof analyticsHistorySelect;
}>;

export type AnalyticsZoneWithSpots = Prisma.ParkingZoneGetPayload<{
  select: typeof analyticsZoneSelect;
}>;

export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async listOccupancyHistorySince(start: Date): Promise<AnalyticsHistoryRecord[]> {
    return this.prisma.occupancyHistory.findMany({
      where: {
        recordedAt: {
          gte: start,
        },
      },
      orderBy: [{ recordedAt: "asc" }, { zone: { displayOrder: "asc" } }, { zone: { name: "asc" } }],
      select: analyticsHistorySelect,
    });
  }

  async listZonesWithSpots(): Promise<AnalyticsZoneWithSpots[]> {
    return this.prisma.parkingZone.findMany({
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: analyticsZoneSelect,
    });
  }
}
