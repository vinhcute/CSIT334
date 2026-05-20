import { Prisma, type IncidentStatus, type PrismaClient, type SpotStatus } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/database.js";
import type { IncidentIssueType } from "../domain/phase05.js";

const incidentWithRelationsSelect = Prisma.validator<Prisma.IncidentReportSelect>()({
  id: true,
  userId: true,
  status: true,
  issueType: true,
  description: true,
  resolution: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  spot: {
    select: {
      id: true,
      spotCode: true,
      status: true,
      level: true,
      rowLabel: true,
      zone: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
});

const spotExistenceSelect = Prisma.validator<Prisma.ParkingSpotSelect>()({
  id: true,
});

export type IncidentReportRecord = Prisma.IncidentReportGetPayload<{
  select: typeof incidentWithRelationsSelect;
}>;

interface IncidentAdminFilters {
  status?: IncidentStatus;
  issueType?: IncidentIssueType;
  spotId?: string;
}

interface CreateIncidentReportInput {
  userId: string;
  issueType: IncidentIssueType;
  description: string;
  spotId?: string | null;
}

export class IncidentReportRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async findSpotExists(spotId: string): Promise<boolean> {
    const spot = await this.prisma.parkingSpot.findUnique({
      where: { id: spotId },
      select: spotExistenceSelect,
    });

    return Boolean(spot);
  }

  async create(input: CreateIncidentReportInput): Promise<IncidentReportRecord> {
    return this.prisma.incidentReport.create({
      data: {
        userId: input.userId,
        issueType: input.issueType,
        description: input.description,
        spotId: input.spotId ?? null,
      },
      select: incidentWithRelationsSelect,
    });
  }

  async listByUserId(userId: string): Promise<IncidentReportRecord[]> {
    return this.prisma.incidentReport.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }],
      select: incidentWithRelationsSelect,
    });
  }

  async listForAdmin(filters: IncidentAdminFilters): Promise<IncidentReportRecord[]> {
    return this.prisma.incidentReport.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.issueType ? { issueType: filters.issueType } : {}),
        ...(filters.spotId ? { spotId: filters.spotId } : {}),
      },
      orderBy: [{ createdAt: "desc" }],
      select: incidentWithRelationsSelect,
    });
  }

  async findById(id: string): Promise<IncidentReportRecord | null> {
    return this.prisma.incidentReport.findUnique({
      where: { id },
      select: incidentWithRelationsSelect,
    });
  }

  async markInReview(id: string): Promise<IncidentReportRecord> {
    return this.prisma.incidentReport.update({
      where: { id },
      data: { status: "inReview" },
      select: incidentWithRelationsSelect,
    });
  }

  async resolve(id: string, resolution: string, resolvedAt: Date): Promise<IncidentReportRecord> {
    return this.prisma.incidentReport.update({
      where: { id },
      data: {
        status: "resolved",
        resolution,
        resolvedAt,
      },
      select: incidentWithRelationsSelect,
    });
  }
}

export type IncidentReportSpotSummaryRecord = {
  id: string;
  spotCode: string;
  status: SpotStatus;
  level: string | null;
  rowLabel: string | null;
  zone: {
    id: string;
    name: string;
  };
};
