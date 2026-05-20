import { Router } from "express";
import { HealthController } from "../controllers/healthController.js";
import type { HealthChecker } from "../services/healthService.js";

export function createHealthRouter(healthService?: HealthChecker): Router {
  const router = Router();
  const controller = new HealthController(healthService);

  router.get("/health", controller.show);

  return router;
}
