import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/database.js";

const zoneAnalyticsSelect = Prisma.validator<Prisma.ParkingZoneSelect>()({
  id: true,
  name: true,
  capacity: true,
  displayOrder: true,
  parkingSpots: {
    select: {
      status: true,
    },
  },
});

const occupancyHistoryAnalyticsSelect =
  Prisma.validator<Prisma.OccupancyHistorySelect>()({
    id: true,
    zoneId: true,
    recordedAt: true,
    capacity: true,
    availableSpots: true,
    occupiedSpots: true,
    reservedSpots: true,
    occupancyRate: true,
  });

export type AnalyticsZone = Prisma.ParkingZoneGetPayload<{
  select: typeof zoneAnalyticsSelect;
}>;

export type AnalyticsOccupancyHistoryRecord = Prisma.OccupancyHistoryGetPayload<{
  select: typeof occupancyHistoryAnalyticsSelect;
}>;

export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async listZonesWithSpotStatuses(): Promise<AnalyticsZone[]> {
    return this.prisma.parkingZone.findMany({
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: zoneAnalyticsSelect,
    });
  }

  async findLatestOccupancyTimestamp(): Promise<Date | null> {
    const latest = await this.prisma.occupancyHistory.findFirst({
      orderBy: { recordedAt: "desc" },
      select: { recordedAt: true },
    });

    return latest?.recordedAt ?? null;
  }

  async listOccupancyHistorySince(start: Date): Promise<AnalyticsOccupancyHistoryRecord[]> {
    return this.prisma.occupancyHistory.findMany({
      where: {
        recordedAt: {
          gte: start,
        },
      },
      orderBy: [{ recordedAt: "asc" }, { zoneId: "asc" }],
      select: occupancyHistoryAnalyticsSelect,
    });
  }
}
