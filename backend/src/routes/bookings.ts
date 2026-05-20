import { Router, type RequestHandler } from "express";
import { BookingController } from "../controllers/bookingController.js";
import { createAuthMiddleware } from "../middleware/authMiddleware.js";
import type { BookingService } from "../services/bookingService.js";

export function createBookingsRouter(
  bookingService?: BookingService,
  authMiddleware: RequestHandler = createAuthMiddleware(),
): Router {
  const router = Router();
  const controller = new BookingController(bookingService);

  router.get("/api/bookings/me", authMiddleware, controller.indexMine);
  router.get("/api/bookings/:id", authMiddleware, controller.showMine);
  router.post("/api/bookings", authMiddleware, controller.create);
  router.post("/api/bookings/:id/cancel", authMiddleware, controller.cancel);

  return router;
}
