import type { Request, Response } from "express";
import {
  AnalyticsService,
  AnalyticsValidationError,
} from "../services/analyticsService.js";

export class AnalyticsController {
  constructor(private readonly analyticsService = new AnalyticsService()) {}

  campus = async (request: Request, response: Response): Promise<void> => {
    try {
      const analytics = await this.analyticsService.getCampusAnalytics(
        getQueryString(request.query, "range"),
      );
      response.json({ analytics });
    } catch (error) {
      if (error instanceof AnalyticsValidationError) {
        response.status(400).json({ error: error.message });
        return;
      }

      throw error;
    }
  };
}

function getQueryString(query: Request["query"], key: string): string | undefined {
  const value = query[key];

  return typeof value === "string" ? value : undefined;
}
