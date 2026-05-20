import type { Request, Response } from "express";
import {
  AnalyticsService,
  AnalyticsValidationError,
} from "../services/analyticsService.js";
import type { AnalyticsRange } from "../domain/phase05.js";

export class AnalyticsController {
  constructor(private readonly analyticsService = new AnalyticsService()) {}

  occupancyTrends = async (request: Request, response: Response): Promise<void> => {
    await this.respond(response, async () => ({
      occupancyTrends: await this.analyticsService.getOccupancyTrends(getRange(request)),
    }));
  };

  peakHours = async (request: Request, response: Response): Promise<void> => {
    await this.respond(response, async () => ({
      peakHours: await this.analyticsService.getPeakHours(getRange(request)),
    }));
  };

  zoneUtilisation = async (_request: Request, response: Response): Promise<void> => {
    await this.respond(response, async () => ({
      zoneUtilisation: await this.analyticsService.getZoneUtilisation(),
    }));
  };

  summary = async (request: Request, response: Response): Promise<void> => {
    await this.respond(response, async () => ({
      summary: await this.analyticsService.getSummary(getRange(request)),
    }));
  };

  private async respond(
    response: Response,
    action: () => Promise<Record<string, unknown>>,
  ): Promise<void> {
    try {
      response.json(await action());
    } catch (error) {
      if (error instanceof AnalyticsValidationError) {
        response.status(400).json({ error: error.message, issues: error.issues });
        return;
      }

      throw error;
    }
  }
}

function getRange(request: Request): AnalyticsRange {
  const range = request.query.range;

  return typeof range === "string" ? (range as AnalyticsRange) : "today";
}
