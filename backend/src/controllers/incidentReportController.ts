import type { Request, Response } from "express";
import {
  IncidentReportNotFoundError,
  IncidentReportService,
  IncidentReportSpotNotFoundError,
  IncidentReportTransitionConflictError,
  IncidentReportValidationError,
} from "../services/incidentReportService.js";

export class IncidentReportController {
  constructor(private readonly incidentReportService = new IncidentReportService()) {}

  create = async (request: Request, response: Response): Promise<void> => {
    if (!request.user) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }

    try {
      const incidentReport = await this.incidentReportService.createReport(
        request.user.userId,
        request.body,
      );
      response.status(201).json({ incidentReport });
    } catch (error) {
      this.handleError(error, response);
    }
  };

  indexMine = async (request: Request, response: Response): Promise<void> => {
    if (!request.user) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }

    try {
      const incidentReports = await this.incidentReportService.listMyReports(request.user.userId);
      response.json({ incidentReports });
    } catch (error) {
      this.handleError(error, response);
    }
  };

  indexAdmin = async (request: Request, response: Response): Promise<void> => {
    try {
      const incidentReports = await this.incidentReportService.listAdminReports(request.query);
      response.json({ incidentReports });
    } catch (error) {
      this.handleError(error, response);
    }
  };

  markInReview = async (request: Request, response: Response): Promise<void> => {
    try {
      const incidentReportId =
        typeof request.params.id === "string" ? request.params.id : "";
      const incidentReport = await this.incidentReportService.markInReview(incidentReportId);
      response.json({ incidentReport });
    } catch (error) {
      this.handleError(error, response);
    }
  };

  resolve = async (request: Request, response: Response): Promise<void> => {
    try {
      const incidentReportId =
        typeof request.params.id === "string" ? request.params.id : "";
      const incidentReport = await this.incidentReportService.resolve(
        incidentReportId,
        request.body,
      );
      response.json({ incidentReport });
    } catch (error) {
      this.handleError(error, response);
    }
  };

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

    if (error instanceof IncidentReportTransitionConflictError) {
      response.status(409).json({ error: error.message });
      return;
    }

    throw error;
  }
}
