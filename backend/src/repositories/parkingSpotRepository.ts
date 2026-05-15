import type { PrismaClient, SpotStatus } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/database.js";

const parkingSpotSelect = {
  id: true,
  zoneId: true,
  spotCode: true,
  status: true,
  level: true,
  rowLabel: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface CreateParkingSpotRecordInput {
  zoneId: string;
  spotCode: string;
  status: SpotStatus;
  level?: string;
  rowLabel?: string;
}

export interface UpdateParkingSpotRecordInput {
  zoneId?: string;
  spotCode?: string;
  status?: SpotStatus;
  level?: string | null;
  rowLabel?: string | null;
}

export interface ListParkingSpotFilters {
  zoneId?: string;
  status?: SpotStatus;
}

export class ParkingSpotRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async list(filters: ListParkingSpotFilters = {}) {
    return this.prisma.parkingSpot.findMany({
      where: {
        zoneId: filters.zoneId,
        status: filters.status,
      },
      orderBy: [{ zoneId: "asc" }, { spotCode: "asc" }],
      select: parkingSpotSelect,
    });
  }

  async findById(id: string) {
    return this.prisma.parkingSpot.findUnique({
      where: { id },
      select: parkingSpotSelect,
    });
  }

  async findByZoneIdAndSpotCode(zoneId: string, spotCode: string) {
    return this.prisma.parkingSpot.findUnique({
      where: {
        zoneId_spotCode: {
          zoneId,
          spotCode,
        },
      },
      select: parkingSpotSelect,
    });
  }

  async countByZoneId(zoneId: string) {
    return this.prisma.parkingSpot.count({
      where: { zoneId },
    });
  }

  async create(input: CreateParkingSpotRecordInput) {
    return this.prisma.parkingSpot.create({
      data: input,
      select: parkingSpotSelect,
    });
  }

  async update(id: string, input: UpdateParkingSpotRecordInput) {
    return this.prisma.parkingSpot.update({
      where: { id },
      data: input,
      select: parkingSpotSelect,
    });
  }

  async delete(id: string) {
    return this.prisma.parkingSpot.delete({
      where: { id },
      select: parkingSpotSelect,
    });
  }
}
