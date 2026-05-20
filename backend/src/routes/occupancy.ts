import { Router, type RequestHandler } from "express";
import { OccupancyController } from "../controllers/occupancyController.js";
import { createAuthMiddleware } from "../middleware/authMiddleware.js";
import type { OccupancyService } from "../services/occupancyService.js";

export function createOccupancyRouter(
  occupancyService?: OccupancyService,
  authMiddleware: RequestHandler = createAuthMiddleware(),
): Router {
  const router = Router();
  const controller = new OccupancyController(occupancyService);

  router.get("/api/occupancy/summary", authMiddleware, controller.summary);
  router.get("/api/occupancy/zones/:zoneId", authMiddleware, controller.zoneDetail);

  return router;
}
