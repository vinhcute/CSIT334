import type { Request, Response } from "express";
import {
  DetectionEventReservedSpotConflictError,
  DetectionEventService,
  DetectionEventSpotNotFoundError,
  DetectionEventValidationError,
} from "../services/detectionEventService.js";

export class DetectionEventController {
  constructor(private readonly detectionEventService = new DetectionEventService()) {}

  index = async (request: Request, response: Response): Promise<void> => {
    try {
      const result = await this.detectionEventService.listRecentDetectionEvents(request.query);
      response.json(result);
    } catch (error) {
      this.handleError(error, response);
    }
  };

  create = async (request: Request, response: Response): Promise<void> => {
    try {
      const result = await this.detectionEventService.ingestDetectionEvent(request.body);
      response.status(201).json(result);
    } catch (error) {
      this.handleError(error, response);
    }
  };

  private handleError(error: unknown, response: Response): void {
    if (error instanceof DetectionEventValidationError) {
      response.status(400).json({ error: error.message, issues: error.issues });
      return;
    }

    if (error instanceof DetectionEventSpotNotFoundError) {
      response.status(404).json({ error: error.message });
      return;
    }

    if (error instanceof DetectionEventReservedSpotConflictError) {
      response.status(409).json({ error: error.message });
      return;
    }

    throw error;
  }
}
