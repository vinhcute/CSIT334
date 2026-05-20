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
  page?: number;
  pageSize?: number;
}

export interface PaginatedParkingSpotResult {
  parkingSpots: ParkingSpotRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

type ParkingSpotRecord = {
  id: string;
  zoneId: string;
  spotCode: string;
  status: SpotStatus;
  level: string | null;
  rowLabel: string | null;
  createdAt: Date;
  updatedAt: Date;
};

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

  async listPaginated(filters: ListParkingSpotFilters = {}): Promise<PaginatedParkingSpotResult> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const where = {
      zoneId: filters.zoneId,
      status: filters.status,
    };
    const [parkingSpots, total] = await this.prisma.$transaction([
      this.prisma.parkingSpot.findMany({
        where,
        orderBy: [{ zoneId: "asc" }, { spotCode: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: parkingSpotSelect,
      }),
      this.prisma.parkingSpot.count({ where }),
    ]);

    return {
      parkingSpots,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
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

  async countByZoneIdAndSpotIds(zoneId: string, spotIds: string[]) {
    return this.prisma.parkingSpot.count({
      where: {
        zoneId,
        id: { in: spotIds },
      },
    });
  }

  async listSpotCodesByZoneId(zoneId: string) {
    return this.prisma.parkingSpot.findMany({
      where: { zoneId },
      select: { spotCode: true },
      orderBy: { spotCode: "asc" },
    });
  }

  async listByZoneIdAndSpotCodes(zoneId: string, spotCodes: string[]) {
    return this.prisma.parkingSpot.findMany({
      where: {
        zoneId,
        spotCode: { in: spotCodes },
      },
      select: parkingSpotSelect,
      orderBy: { spotCode: "asc" },
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

  async updateLevelByZoneId(zoneId: string, level: string) {
    const result = await this.prisma.parkingSpot.updateMany({
      where: { zoneId },
      data: { level },
    });

    return result.count;
  }

  async updateLevelByZoneIdAndSpotIds(zoneId: string, spotIds: string[], level: string) {
    const result = await this.prisma.parkingSpot.updateMany({
      where: {
        zoneId,
        id: { in: spotIds },
      },
      data: { level },
    });

    return result.count;
  }

  async updateLevelByZoneIdAndSpotCodes(zoneId: string, spotCodes: string[], level: string) {
    const result = await this.prisma.parkingSpot.updateMany({
      where: {
        zoneId,
        spotCode: { in: spotCodes },
      },
      data: { level },
    });

    return result.count;
  }

  async delete(id: string) {
    return this.prisma.parkingSpot.delete({
      where: { id },
      select: parkingSpotSelect,
    });
  }
}
