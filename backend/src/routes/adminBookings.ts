import { Router, type RequestHandler } from "express";
import { AdminBookingController } from "../controllers/adminBookingController.js";
import { createAuthMiddleware } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/requireRole.js";
import type { BookingService } from "../services/bookingService.js";

export function createAdminBookingsRouter(
  bookingService?: BookingService,
  authMiddleware: RequestHandler = createAuthMiddleware(),
): Router {
  const router = Router();
  const controller = new AdminBookingController(bookingService);
  const adminOnly = [authMiddleware, requireRole("admin")];

  router.get("/api/admin/bookings", adminOnly, controller.index);
  router.get("/api/admin/bookings/:id", adminOnly, controller.show);

  return router;
}
