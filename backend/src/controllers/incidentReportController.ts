import type { Request, Response } from "express";
import type { Query } from "express-serve-static-core";
import {
  IncidentReportConflictError,
  IncidentReportNotFoundError,
  IncidentReportService,
  IncidentReportSpotNotFoundError,
  IncidentReportValidationError,
} from "../services/incidentReportService.js";

export class IncidentReportController {
  constructor(private readonly incidentReportService = new IncidentReportService()) {}

  create = async (request: Request, response: Response): Promise<void> => {
    try {
      const userId = this.getAuthenticatedUserId(request);
      const incidentReport = await this.incidentReportService.createForUser(
        userId,
        request.body,
      );
      response.status(201).json({ incidentReport });
    } catch (error) {
      this.handleError(error, response);
    }
  };

  myReports = async (request: Request, response: Response): Promise<void> => {
    const userId = this.getAuthenticatedUserId(request);
    const incidentReports = await this.incidentReportService.listForUser(userId);
    response.json({ incidentReports });
  };

  adminIndex = async (request: Request, response: Response): Promise<void> => {
    try {
      const incidentReports = await this.incidentReportService.listForAdmin({
        status: getQueryString(request.query, "status"),
        issueType: getQueryString(request.query, "issueType"),
        spotId: getQueryString(request.query, "spotId"),
      });
      response.json({ incidentReports });
    } catch (error) {
      this.handleError(error, response);
    }
  };

  markInReview = async (request: Request, response: Response): Promise<void> => {
    try {
      const incidentReport = await this.incidentReportService.markInReview(
        getRouteParam(request.params, "id"),
      );
      response.json({ incidentReport });
    } catch (error) {
      this.handleError(error, response);
    }
  };

  resolve = async (request: Request, response: Response): Promise<void> => {
    try {
      const incidentReport = await this.incidentReportService.resolve(
        getRouteParam(request.params, "id"),
        request.body,
      );
      response.json({ incidentReport });
    } catch (error) {
      this.handleError(error, response);
    }
  };

  private getAuthenticatedUserId(request: Request): string {
    if (!request.user) {
      throw new Error("Authenticated user missing after auth middleware.");
    }

    return request.user.userId;
  }

  private handleError(error: unknown, response: Response): void {
    if (error instanceof IncidentReportValidationError) {
      response.status(400).json({ error: error.message, issues: error.issues });
      return;
    }

    if (
      error instanceof IncidentReportNotFoundError ||
      error instanceof IncidentReportSpotNotFoundError
    ) {
      response.status(404).json({ error: error.message });
      return;
    }

    if (error instanceof IncidentReportConflictError) {
      response.status(409).json({ error: error.message });
      return;
    }

    throw error;
  }
}

function getQueryString(query: Query, key: string): string | undefined {
  const value = query[key];

  return typeof value === "string" ? value : undefined;
}

function getRouteParam(params: Record<string, unknown>, key: string): string {
  const value = params[key];

  if (typeof value !== "string" || !value) {
    throw new IncidentReportValidationError([`${key} is required.`]);
  }

  return value;
}
