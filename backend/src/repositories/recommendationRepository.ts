import type { PrismaClient, SpotStatus } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/database.js";

export interface RecommendationSpotRecord {
  status: SpotStatus;
}

export interface RecommendationZoneWithSpots {
  id: string;
  name: string;
  capacity: number;
  distanceFromEntryMeters: number | null;
  displayOrder: number;
  parkingSpots: RecommendationSpotRecord[];
}

export class RecommendationRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async listZonesWithSpots(): Promise<RecommendationZoneWithSpots[]> {
    return this.prisma.parkingZone.findMany({
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        capacity: true,
        distanceFromEntryMeters: true,
        displayOrder: true,
        parkingSpots: {
          select: {
            status: true,
          },
        },
      },
    });
  }
}
