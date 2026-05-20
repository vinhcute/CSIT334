import type { Request, Response } from "express";
import {
  OccupancyService,
  OccupancyZoneNotFoundError,
} from "../services/occupancyService.js";

export class OccupancyController {
  constructor(private readonly occupancyService = new OccupancyService()) {}

  summary = async (_request: Request, response: Response): Promise<void> => {
    const summary = await this.occupancyService.getSummary();
    response.json({ summary });
  };

  zoneDetail = async (request: Request, response: Response): Promise<void> => {
    const zoneId = request.params.zoneId;

    if (typeof zoneId !== "string") {
      response.status(400).json({ error: "Parking zone ID is required." });
      return;
    }

    try {
      const zone = await this.occupancyService.getZoneDetail(zoneId);
      response.json({ zone });
    } catch (error) {
      if (error instanceof OccupancyZoneNotFoundError) {
        response.status(404).json({ error: error.message });
        return;
      }

      throw error;
    }
  };
}
