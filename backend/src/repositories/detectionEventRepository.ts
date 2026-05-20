import type { DetectionEventType, Prisma, PrismaClient, SpotStatus } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/database.js";

const detectionEventSelect = {
  id: true,
  spotId: true,
  type: true,
  occurredAt: true,
  rawPayload: true,
  createdAt: true,
  spot: {
    select: {
      id: true,
      zoneId: true,
      spotCode: true,
    },
  },
} as const;

const updatedParkingSpotSelect = {
  id: true,
  zoneId: true,
  spotCode: true,
  status: true,
  level: true,
  rowLabel: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface CreateDetectionEventRecordInput {
  spotId: string;
  type: DetectionEventType;
  occurredAt?: Date;
  rawPayload?: Prisma.InputJsonValue;
}

export interface ListDetectionEventFilters {
  page: number;
  pageSize: number;
  spotId?: string;
  type?: DetectionEventType;
}

export class DetectionEventRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async listPaginated(filters: ListDetectionEventFilters) {
    const where = {
      spotId: filters.spotId,
      type: filters.type,
    };
    const [detectionEvents, total] = await this.prisma.$transaction([
      this.prisma.detectionEvent.findMany({
        where,
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        select: detectionEventSelect,
      }),
      this.prisma.detectionEvent.count({ where }),
    ]);

    return {
      detectionEvents,
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
      },
    };
  }

  async createAndUpdateSpotStatus(
    input: CreateDetectionEventRecordInput,
    nextStatus: SpotStatus,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const detectionEvent = await transaction.detectionEvent.create({
        data: input,
        select: detectionEventSelect,
      });
      const parkingSpot = await transaction.parkingSpot.update({
        where: { id: input.spotId },
        data: { status: nextStatus },
        select: updatedParkingSpotSelect,
      });

      return { detectionEvent, parkingSpot };
    });
  }
}
