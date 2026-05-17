import type { IncidentStatus, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/database.js";

export const incidentReportSelect = {
  id: true,
  userId: true,
  spotId: true,
  status: true,
  issueType: true,
  description: true,
  resolution: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      accountStatus: true,
    },
  },
  spot: {
    select: {
      id: true,
      spotCode: true,
      status: true,
      zone: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} as const;

export interface CreateIncidentReportRecordInput {
  userId: string;
  spotId?: string;
  issueType: string;
  description: string;
}

export interface ListIncidentReportFilters {
  status?: IncidentStatus;
  issueType?: string;
  spotId?: string;
}

export class IncidentReportRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async create(input: CreateIncidentReportRecordInput) {
    return this.prisma.incidentReport.create({
      data: input,
      select: incidentReportSelect,
    });
  }

  async findById(id: string) {
    return this.prisma.incidentReport.findUnique({
      where: { id },
      select: incidentReportSelect,
    });
  }

  async listByUserId(userId: string) {
    return this.prisma.incidentReport.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: incidentReportSelect,
    });
  }

  async list(filters: ListIncidentReportFilters = {}) {
    return this.prisma.incidentReport.findMany({
      where: {
        status: filters.status,
        issueType: filters.issueType,
        spotId: filters.spotId,
      },
      orderBy: { createdAt: "desc" },
      select: incidentReportSelect,
    });
  }

  async updateStatus(
    id: string,
    input: {
      status: IncidentStatus;
      resolution?: string | null;
      resolvedAt?: Date | null;
    },
  ) {
    return this.prisma.incidentReport.update({
      where: { id },
      data: input,
      select: incidentReportSelect,
    });
  }
}
