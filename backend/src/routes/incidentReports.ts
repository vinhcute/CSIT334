import { Router, type RequestHandler } from "express";
import { IncidentReportController } from "../controllers/incidentReportController.js";
import { createAuthMiddleware } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/requireRole.js";
import type { IncidentReportService } from "../services/incidentReportService.js";

export function createIncidentReportsRouter(
  incidentReportService?: IncidentReportService,
  authMiddleware: RequestHandler = createAuthMiddleware(),
): Router {
  const router = Router();
  const controller = new IncidentReportController(incidentReportService);
  const adminOnly = [authMiddleware, requireRole("admin")];

  router.post("/api/incident-reports", authMiddleware, controller.create);
  router.get("/api/incident-reports/me", authMiddleware, controller.indexMine);

  router.get("/api/admin/incident-reports", adminOnly, controller.indexAdmin);
  router.patch("/api/admin/incident-reports/:id/in-review", adminOnly, controller.markInReview);
  router.patch("/api/admin/incident-reports/:id/resolve", adminOnly, controller.resolve);

  return router;
}
