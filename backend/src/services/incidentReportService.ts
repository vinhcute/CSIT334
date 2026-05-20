import { z } from "zod";
import { SpotStatus, type IncidentStatus } from "@prisma/client";
import {
  IncidentStatus as DomainIncidentStatus,
  SpotStatus as DomainSpotStatus,
} from "../domain/enums.js";
import { parkingEvents } from "../realtime/parkingEvents.js";
import type {
  IncidentIssueType,
  IncidentReportDetail,
  IncidentReportSummary,
} from "../domain/phase05.js";
import { OccupancyService, type ZoneOccupancySummary } from "./occupancyService.js";
import { ParkingSpotRepository } from "../repositories/parkingSpotRepository.js";
import {
  IncidentReportRepository,
  type IncidentReportRecord,
} from "../repositories/incidentReportRepository.js";

const incidentIssueTypeSchema = z.enum([
  "spotDiscrepancy",
  "sensorFault",
  "paymentIssue",
  "safetyConcern",
  "other",
]);

const createIncidentReportSchema = z.object({
  issueType: incidentIssueTypeSchema,
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters.")
    .max(1000, "Description cannot exceed 1000 characters."),
  spotId: z.string().trim().min(1, "Spot ID cannot be blank.").optional(),
});

const adminIncidentFiltersSchema = z.object({
  status: z.enum(["open", "inReview", "resolved"]).optional(),
  issueType: incidentIssueTypeSchema.optional(),
  spotId: z.string().trim().min(1, "Spot ID cannot be blank.").optional(),
});

const resolveIncidentReportSchema = z.object({
  resolution: z
    .string()
    .trim()
    .min(5, "Resolution must be at least 5 characters.")
    .max(1000, "Resolution cannot exceed 1000 characters."),
});

export interface IncidentReportReader {
  findSpotExists(spotId: string): Promise<boolean>;
  create(input: {
    userId: string;
    issueType: IncidentIssueType;
    description: string;
    spotId?: string | null;
  }): Promise<IncidentReportRecord>;
  listByUserId(userId: string): Promise<IncidentReportRecord[]>;
  listForAdmin(filters: {
    status?: IncidentStatus;
    issueType?: IncidentIssueType;
    spotId?: string;
  }): Promise<IncidentReportRecord[]>;
  findById(id: string): Promise<IncidentReportRecord | null>;
  markInReview(id: string): Promise<IncidentReportRecord>;
  resolve(id: string, resolution: string, resolvedAt: Date): Promise<IncidentReportRecord>;
}

export interface IncidentReportSpotReader {
  findById(id: string): Promise<{ id: string; zoneId: string; status: SpotStatus } | null>;
  update(
    id: string,
    input: { status: SpotStatus },
  ): Promise<{ id: string; zoneId: string; status: SpotStatus }>;
}

export interface IncidentReportOccupancyWriter {
  getZoneDetail(zoneId: string): Promise<ZoneOccupancySummary & { spots: unknown[] }>;
  recordZoneHistory(zoneId: string, recordedAt?: Date): Promise<unknown>;
}

export interface IncidentReportParkingEventStream {
  broadcastParkingUpdate(input: {
    spotId: string;
    zoneId: string;
    status: string;
    zoneSummary: ZoneOccupancySummary & { spots: unknown[] };
  }): void;
}

export class IncidentReportValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super("Incident report input is invalid.");
    this.name = "IncidentReportValidationError";
  }
}

export class IncidentReportNotFoundError extends Error {
  constructor() {
    super("Incident report not found.");
    this.name = "IncidentReportNotFoundError";
  }
}

export class IncidentReportSpotNotFoundError extends Error {
  constructor() {
    super("Parking spot not found.");
    this.name = "IncidentReportSpotNotFoundError";
  }
}

export class IncidentReportTransitionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IncidentReportTransitionConflictError";
  }
}

export class IncidentReportService {
  constructor(
    private readonly incidentReportRepository: IncidentReportReader = new IncidentReportRepository(),
    private readonly parkingSpotRepository: IncidentReportSpotReader = new ParkingSpotRepository(),
    private readonly occupancyService: IncidentReportOccupancyWriter = new OccupancyService(),
    private readonly parkingEventStream: IncidentReportParkingEventStream = parkingEvents,
  ) {}

  async createReport(
    userId: string,
    input: unknown,
  ): Promise<IncidentReportDetail> {
    const normalizedUserId = userId.trim();

    if (!normalizedUserId) {
      throw new IncidentReportValidationError(["User ID is required."]);
    }

    const parsed = createIncidentReportSchema.safeParse(input ?? {});

    if (!parsed.success) {
      throw new IncidentReportValidationError(parsed.error.issues.map((issue) => issue.message));
    }

    if (parsed.data.spotId) {
      const spotExists = await this.incidentReportRepository.findSpotExists(parsed.data.spotId);

      if (!spotExists) {
        throw new IncidentReportSpotNotFoundError();
      }
    }

    const report = await this.incidentReportRepository.create({
      userId: normalizedUserId,
      issueType: parsed.data.issueType,
      description: parsed.data.description,
      spotId: parsed.data.spotId ?? null,
    });

    await this.applyMaintenanceFlagForSpotDiscrepancy(
      parsed.data.issueType,
      parsed.data.spotId ?? null,
    );

    return toIncidentReportDetail(report);
  }

  async listMyReports(userId: string): Promise<IncidentReportSummary[]> {
    const normalizedUserId = userId.trim();

    if (!normalizedUserId) {
      throw new IncidentReportValidationError(["User ID is required."]);
    }

    const reports = await this.incidentReportRepository.listByUserId(normalizedUserId);

    return reports.map(toIncidentReportSummary);
  }

  async listAdminReports(filters: unknown): Promise<IncidentReportSummary[]> {
    const parsed = adminIncidentFiltersSchema.safeParse(filters ?? {});

    if (!parsed.success) {
      throw new IncidentReportValidationError(parsed.error.issues.map((issue) => issue.message));
    }

    const reports = await this.incidentReportRepository.listForAdmin(parsed.data);

    return reports.map(toIncidentReportSummary);
  }

  async markInReview(id: string): Promise<IncidentReportDetail> {
    const reportId = id.trim();

    if (!reportId) {
      throw new IncidentReportValidationError(["Incident report ID is required."]);
    }

    const report = await this.incidentReportRepository.findById(reportId);

    if (!report) {
      throw new IncidentReportNotFoundError();
    }

    if (report.status !== "open") {
      throw new IncidentReportTransitionConflictError(
        "Only open incident reports can be moved to in review.",
      );
    }

    const updated = await this.incidentReportRepository.markInReview(reportId);

    return toIncidentReportDetail(updated);
  }

  async resolve(id: string, input: unknown, now = new Date()): Promise<IncidentReportDetail> {
    const reportId = id.trim();

    if (!reportId) {
      throw new IncidentReportValidationError(["Incident report ID is required."]);
    }

    const parsed = resolveIncidentReportSchema.safeParse(input ?? {});

    if (!parsed.success) {
      throw new IncidentReportValidationError(parsed.error.issues.map((issue) => issue.message));
    }

    const report = await this.incidentReportRepository.findById(reportId);

    if (!report) {
      throw new IncidentReportNotFoundError();
    }

    if (report.status === "resolved") {
      throw new IncidentReportTransitionConflictError(
        "Resolved incident reports cannot be resolved again.",
      );
    }

    const resolved = await this.incidentReportRepository.resolve(
      reportId,
      parsed.data.resolution,
      now,
    );

    return toIncidentReportDetail(resolved);
  }

  private async applyMaintenanceFlagForSpotDiscrepancy(
    issueType: IncidentIssueType,
    spotId: string | null,
  ): Promise<void> {
    if (issueType !== "spotDiscrepancy" || !spotId) {
      return;
    }

    const spot = await this.parkingSpotRepository.findById(spotId);

    if (!spot) {
      return;
    }

    // Preserve reservation safety: do not overwrite reserved spots here.
    if (spot.status === SpotStatus.reserved || spot.status === SpotStatus.maintenanceRequired) {
      return;
    }

    const updatedSpot = await this.parkingSpotRepository.update(spot.id, {
      status: SpotStatus.maintenanceRequired,
    });
    const zoneSummary = await this.occupancyService.getZoneDetail(updatedSpot.zoneId);
    this.parkingEventStream.broadcastParkingUpdate({
      spotId: updatedSpot.id,
      zoneId: updatedSpot.zoneId,
      status: updatedSpot.status,
      zoneSummary,
    });
    await this.occupancyService.recordZoneHistory(updatedSpot.zoneId);
  }
}

function toIncidentReportSummary(report: IncidentReportRecord): IncidentReportSummary {
  return {
    id: report.id,
    userId: report.userId,
    status: toDomainIncidentStatus(report.status),
    issueType: report.issueType as IncidentIssueType,
    descriptionPreview:
      report.description.length <= 140
        ? report.description
        : `${report.description.slice(0, 137)}...`,
    spot: report.spot
      ? {
          id: report.spot.id,
          spotCode: report.spot.spotCode,
          status: toDomainSpotStatus(report.spot.status),
          zone: {
            id: report.spot.zone.id,
            name: report.spot.zone.name,
          },
          level: report.spot.level,
          rowLabel: report.spot.rowLabel,
        }
      : null,
    reporter: report.user
      ? {
          id: report.user.id,
          name: report.user.name,
          email: report.user.email,
        }
      : null,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    resolvedAt: report.resolvedAt,
  };
}

function toDomainIncidentStatus(status: IncidentStatus): DomainIncidentStatus {
  const map: Record<IncidentStatus, DomainIncidentStatus> = {
    open: DomainIncidentStatus.Open,
    inReview: DomainIncidentStatus.InReview,
    resolved: DomainIncidentStatus.Resolved,
  };

  return map[status];
}

function toDomainSpotStatus(status: "available" | "occupied" | "reserved" | "maintenanceRequired"): DomainSpotStatus {
  const map: Record<
    "available" | "occupied" | "reserved" | "maintenanceRequired",
    DomainSpotStatus
  > = {
    available: DomainSpotStatus.Available,
    occupied: DomainSpotStatus.Occupied,
    reserved: DomainSpotStatus.Reserved,
    maintenanceRequired: DomainSpotStatus.MaintenanceRequired,
  };

  return map[status];
}

function toIncidentReportDetail(report: IncidentReportRecord): IncidentReportDetail {
  const summary = toIncidentReportSummary(report);

  return {
    ...summary,
    description: report.description,
    resolution: report.resolution,
  };
}
