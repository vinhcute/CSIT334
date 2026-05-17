import { IncidentStatus } from "@prisma/client";
import { z } from "zod";
import { IncidentReportRepository } from "../repositories/incidentReportRepository.js";
import { ParkingSpotRepository } from "../repositories/parkingSpotRepository.js";

const incidentIssueTypes = [
  "spotDiscrepancy",
  "parkingIssue",
  "safetyConcern",
  "accessibilityIssue",
] as const;

const createIncidentReportSchema = z.object({
  spotId: z.string().trim().min(1, "Parking spot ID is required.").optional(),
  issueType: z.enum(incidentIssueTypes, {
    error: "Issue type is invalid.",
  }),
  description: z.string().trim().min(1, "Description is required.").max(1000),
});

const adminIncidentReportFiltersSchema = z.object({
  status: z.enum(["open", "inReview", "resolved"]).optional(),
  issueType: z.enum(incidentIssueTypes).optional(),
  spotId: z.string().trim().min(1, "Parking spot ID is required.").optional(),
});

const resolveIncidentReportSchema = z.object({
  resolution: z.string().trim().min(1, "Resolution is required.").max(600),
});

export type CreateIncidentReportInput = z.input<typeof createIncidentReportSchema>;
export type ListAdminIncidentReportFilters = z.input<
  typeof adminIncidentReportFiltersSchema
>;
export type ResolveIncidentReportInput = z.input<typeof resolveIncidentReportSchema>;

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

export class IncidentReportConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IncidentReportConflictError";
  }
}

export class IncidentReportService {
  constructor(
    private readonly incidentReportRepository = new IncidentReportRepository(),
    private readonly parkingSpotRepository = new ParkingSpotRepository(),
  ) {}

  async createForUser(userId: string, input: CreateIncidentReportInput) {
    const parsed = createIncidentReportSchema.safeParse(input);

    if (!parsed.success) {
      throw new IncidentReportValidationError(
        parsed.error.issues.map((issue) => issue.message),
      );
    }

    if (parsed.data.spotId) {
      const parkingSpot = await this.parkingSpotRepository.findById(parsed.data.spotId);

      if (!parkingSpot) {
        throw new IncidentReportSpotNotFoundError();
      }
    }

    return this.incidentReportRepository.create({
      userId,
      ...parsed.data,
    });
  }

  async listForUser(userId: string) {
    return this.incidentReportRepository.listByUserId(userId);
  }

  async listForAdmin(filters: unknown = {}) {
    const parsed = adminIncidentReportFiltersSchema.safeParse(filters);

    if (!parsed.success) {
      throw new IncidentReportValidationError(
        parsed.error.issues.map((issue) => issue.message),
      );
    }

    return this.incidentReportRepository.list(parsed.data);
  }

  async markInReview(id: string) {
    const incidentReport = await this.incidentReportRepository.findById(id);

    if (!incidentReport) {
      throw new IncidentReportNotFoundError();
    }

    if (incidentReport.status === IncidentStatus.resolved) {
      throw new IncidentReportConflictError("Resolved incidents cannot be marked in review.");
    }

    return this.incidentReportRepository.updateStatus(id, {
      status: IncidentStatus.inReview,
      resolvedAt: null,
      resolution: null,
    });
  }

  async resolve(id: string, input: ResolveIncidentReportInput) {
    const parsed = resolveIncidentReportSchema.safeParse(input);

    if (!parsed.success) {
      throw new IncidentReportValidationError(
        parsed.error.issues.map((issue) => issue.message),
      );
    }

    const incidentReport = await this.incidentReportRepository.findById(id);

    if (!incidentReport) {
      throw new IncidentReportNotFoundError();
    }

    return this.incidentReportRepository.updateStatus(id, {
      status: IncidentStatus.resolved,
      resolution: parsed.data.resolution,
      resolvedAt: new Date(),
    });
  }
}
