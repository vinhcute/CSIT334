import type { Request, Response } from "express";
import { RecommendationService } from "../services/recommendationService.js";

export class RecommendationController {
  constructor(private readonly recommendationService = new RecommendationService()) {}

  nearestZone = async (_request: Request, response: Response): Promise<void> => {
    const recommendation = await this.recommendationService.getNearestAvailableZone();

    response.json({ recommendation });
  };

  leastCongestedZone = async (_request: Request, response: Response): Promise<void> => {
    const recommendation = await this.recommendationService.getLeastCongestedZone();

    response.json({ recommendation });
  };

  zones = async (_request: Request, response: Response): Promise<void> => {
    const recommendations = await this.recommendationService.getZoneRecommendations();

    response.json({ recommendations });
  };
}
