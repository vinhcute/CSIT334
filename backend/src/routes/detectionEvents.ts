import { Router, type RequestHandler } from "express";
import { DetectionEventController } from "../controllers/detectionEventController.js";
import { createAuthMiddleware } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/requireRole.js";
import type { DetectionEventService } from "../services/detectionEventService.js";

export function createDetectionEventsRouter(
  detectionEventService?: DetectionEventService,
  authMiddleware: RequestHandler = createAuthMiddleware(),
): Router {
  const router = Router();
  const controller = new DetectionEventController(detectionEventService);
  const adminOnly = [authMiddleware, requireRole("admin")];

  router.get("/api/admin/detection-events", adminOnly, controller.index);
  router.post("/api/admin/detection-events", adminOnly, controller.create);

  return router;
}
