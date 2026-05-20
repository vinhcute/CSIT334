import type { Request, Response } from "express";
import {
  PredictiveAvailabilityService,
  PredictiveAvailabilityValidationError,
  PredictiveAvailabilityZoneNotFoundError,
} from "../services/predictiveAvailabilityService.js";

export class PredictiveAvailabilityController {
  constructor(
    private readonly predictiveAvailabilityService = new PredictiveAvailabilityService(),
  ) {}

  predict = async (request: Request, response: Response): Promise<void> => {
    try {
      const prediction = await this.predictiveAvailabilityService.predictAvailability({
        zoneId: getQueryString(request.query.zoneId),
        targetTime: new Date(getQueryString(request.query.targetTime)),
      });

      response.json({ prediction });
    } catch (error) {
      if (error instanceof PredictiveAvailabilityValidationError) {
        response.status(400).json({ error: error.message, issues: error.issues });
        return;
      }

      if (error instanceof PredictiveAvailabilityZoneNotFoundError) {
        response.status(404).json({ error: error.message });
        return;
      }

      throw error;
    }
  };
}

function getQueryString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
