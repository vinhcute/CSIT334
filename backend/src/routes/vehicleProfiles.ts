import { Router, type RequestHandler } from "express";
import { VehicleProfileController } from "../controllers/vehicleProfileController.js";
import { createAuthMiddleware } from "../middleware/authMiddleware.js";
import type { VehicleProfileService } from "../services/vehicleProfileService.js";

export function createVehicleProfilesRouter(
  vehicleProfileService?: VehicleProfileService,
  authMiddleware: RequestHandler = createAuthMiddleware(),
): Router {
  const router = Router();
  const controller = new VehicleProfileController(vehicleProfileService);

  router.get("/api/vehicle-profiles/me", authMiddleware, controller.listMine);
  router.post("/api/vehicle-profiles", authMiddleware, controller.createMine);
  router.patch("/api/vehicle-profiles/:id", authMiddleware, controller.updateMine);

  return router;
}
