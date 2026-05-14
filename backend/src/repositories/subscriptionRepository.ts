import type { PrismaClient, SubscriptionType } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/database.js";

const safeSubscriptionSelect = {
  id: true,
  userId: true,
  type: true,
  status: true,
  startTime: true,
  endTime: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface CreateSubscriptionInput {
  userId: string;
  type: SubscriptionType;
  startTime: Date;
  endTime: Date;
}

export class SubscriptionRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async findLatestActiveByUserId(userId: string) {
    return this.prisma.subscription.findFirst({
      where: {
        userId,
        status: "active",
      },
      orderBy: { endTime: "desc" },
      select: safeSubscriptionSelect,
    });
  }

  async createActive(input: CreateSubscriptionInput) {
    return this.prisma.subscription.create({
      data: {
        userId: input.userId,
        type: input.type,
        status: "active",
        startTime: input.startTime,
        endTime: input.endTime,
      },
      select: safeSubscriptionSelect,
    });
  }
}
