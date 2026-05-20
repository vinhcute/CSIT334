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
  const adminOnly = [authMiddleware, requireRole("admin")];

  router.get("/api/admin/analytics/occupancy-trends", adminOnly, controller.occupancyTrends);
  router.get("/api/admin/analytics/peak-hours", adminOnly, controller.peakHours);
  router.get("/api/admin/analytics/zone-utilisation", adminOnly, controller.zoneUtilisation);
  router.get("/api/admin/analytics/summary", adminOnly, controller.summary);

  return router;
}
