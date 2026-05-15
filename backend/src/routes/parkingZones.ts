import { Router, type RequestHandler } from "express";
import { ParkingZoneController } from "../controllers/parkingZoneController.js";
import { createAuthMiddleware } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/requireRole.js";
import type { ParkingZoneService } from "../services/parkingZoneService.js";

export function createParkingZonesRouter(
  parkingZoneService?: ParkingZoneService,
  authMiddleware: RequestHandler = createAuthMiddleware(),
): Router {
  const router = Router();
  const controller = new ParkingZoneController(parkingZoneService);
  const adminOnly = [authMiddleware, requireRole("admin")];

  router.get("/api/parking-zones", authMiddleware, controller.index);
  router.post("/api/admin/parking-zones", adminOnly, controller.create);
  router.patch("/api/admin/parking-zones/:id", adminOnly, controller.update);
  router.delete("/api/admin/parking-zones/:id", adminOnly, controller.delete);

  return router;
}
