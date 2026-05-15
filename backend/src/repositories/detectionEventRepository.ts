import type { DetectionEventType, Prisma, PrismaClient, SpotStatus } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/database.js";

const detectionEventSelect = {
  id: true,
  spotId: true,
  type: true,
  occurredAt: true,
  rawPayload: true,
  createdAt: true,
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

export class DetectionEventRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async listRecent(limit = 50) {
    return this.prisma.detectionEvent.findMany({
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: detectionEventSelect,
    });
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
