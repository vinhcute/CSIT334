import { Router, type RequestHandler } from "express";
import { PredictiveAvailabilityController } from "../controllers/predictiveAvailabilityController.js";
import { createAuthMiddleware } from "../middleware/authMiddleware.js";
import type { PredictiveAvailabilityService } from "../services/predictiveAvailabilityService.js";

export function createPredictiveAvailabilityRouter(
  predictiveAvailabilityService?: PredictiveAvailabilityService,
  authMiddleware: RequestHandler = createAuthMiddleware(),
): Router {
  const router = Router();
  const controller = new PredictiveAvailabilityController(predictiveAvailabilityService);

  router.get("/api/predictive-availability", authMiddleware, controller.predict);

  return router;
}
