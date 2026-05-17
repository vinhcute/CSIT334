import { Router, type RequestHandler } from "express";
import { AnalyticsController } from "../controllers/analyticsController.js";
import { createAuthMiddleware } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/requireRole.js";
import type { AnalyticsService } from "../services/analyticsService.js";

export function createAnalyticsRouter(
  analyticsService?: AnalyticsService,
  authMiddleware: RequestHandler = createAuthMiddleware(),
): Router {
  const router = Router();
  const controller = new AnalyticsController(analyticsService);

  router.get(
    "/api/admin/analytics",
    authMiddleware,
    requireRole("admin"),
    controller.campus,
  );

  return router;
}
