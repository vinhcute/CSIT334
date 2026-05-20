import { Router, type RequestHandler } from "express";
import { RecommendationController } from "../controllers/recommendationController.js";
import { createAuthMiddleware } from "../middleware/authMiddleware.js";
import type { RecommendationService } from "../services/recommendationService.js";

export function createRecommendationsRouter(
  recommendationService?: RecommendationService,
  authMiddleware: RequestHandler = createAuthMiddleware(),
): Router {
  const router = Router();
  const controller = new RecommendationController(recommendationService);

  router.get("/api/recommendations/nearest-zone", authMiddleware, controller.nearestZone);
  router.get(
    "/api/recommendations/least-congested-zone",
    authMiddleware,
    controller.leastCongestedZone,
  );
  router.get("/api/recommendations/zones", authMiddleware, controller.zones);

  return router;
}
