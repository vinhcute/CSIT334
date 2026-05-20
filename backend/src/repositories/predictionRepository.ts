import type { PrismaClient, SpotStatus } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/database.js";

export interface PredictionSpotRecord {
  status: SpotStatus;
}

export interface PredictionZoneWithSpots {
  id: string;
  name: string;
  capacity: number;
  parkingSpots: PredictionSpotRecord[];
}

export interface PredictionOccupancyHistoryRecord {
  id: string;
  zoneId: string;
  recordedAt: Date;
  capacity: number;
  availableSpots: number;
  occupiedSpots: number;
  reservedSpots: number;
  occupancyRate: { toString(): string };
}

export class PredictionRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async findZoneWithCurrentSpots(zoneId: string): Promise<PredictionZoneWithSpots | null> {
    return this.prisma.parkingZone.findUnique({
      where: { id: zoneId },
      select: {
        id: true,
        name: true,
        capacity: true,
        parkingSpots: {
          select: {
            status: true,
          },
        },
      },
    });
  }

  async listRecentHistory(
    zoneId: string,
    limit = 240,
  ): Promise<PredictionOccupancyHistoryRecord[]> {
    return this.prisma.occupancyHistory.findMany({
      where: { zoneId },
      orderBy: [{ recordedAt: "desc" }],
      take: limit,
      select: {
        id: true,
        zoneId: true,
        recordedAt: true,
        capacity: true,
        availableSpots: true,
        occupiedSpots: true,
        reservedSpots: true,
        occupancyRate: true,
      },
    });
  }
}
