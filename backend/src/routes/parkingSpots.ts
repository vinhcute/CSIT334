import { Router, type RequestHandler } from "express";
import { ParkingSpotController } from "../controllers/parkingSpotController.js";
import { createAuthMiddleware } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/requireRole.js";
import type { ParkingSpotService } from "../services/parkingSpotService.js";

export function createParkingSpotsRouter(
  parkingSpotService?: ParkingSpotService,
  authMiddleware: RequestHandler = createAuthMiddleware(),
): Router {
  const router = Router();
  const controller = new ParkingSpotController(parkingSpotService);
  const adminOnly = [authMiddleware, requireRole("admin")];

  router.get("/api/parking-spots", authMiddleware, controller.index);
  router.get("/api/parking-zones/:zoneId/parking-spots", authMiddleware, controller.indexForZone);
  router.get("/api/admin/parking-zones/:zoneId/next-spot-code", adminOnly, controller.nextSpotCode);
  router.patch("/api/admin/parking-spots/bulk-level", adminOnly, controller.bulkLevelUpdate);
  router.post("/api/admin/parking-spots", adminOnly, controller.create);
  router.patch("/api/admin/parking-spots/:id", adminOnly, controller.update);
  router.delete("/api/admin/parking-spots/:id", adminOnly, controller.delete);

  return router;
}
