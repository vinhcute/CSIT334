import { Router, type RequestHandler } from "express";
import { AdminUserController } from "../controllers/adminUserController.js";
import { createAuthMiddleware } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/requireRole.js";
import type { AdminUserService } from "../services/adminUserService.js";

export function createAdminUsersRouter(
  adminUserService?: AdminUserService,
  authMiddleware: RequestHandler = createAuthMiddleware(),
): Router {
  const router = Router();
  const controller = new AdminUserController(adminUserService);
  const adminOnly = [authMiddleware, requireRole("admin")];

  router.get("/api/admin/users", adminOnly, controller.index);
  router.patch("/api/admin/users/:id/disable", adminOnly, controller.disable);
  router.patch("/api/admin/users/:id/reactivate", adminOnly, controller.reactivate);

  return router;
}
