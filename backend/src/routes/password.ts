import { Router, type RequestHandler } from "express";
import { PasswordController } from "../controllers/passwordController.js";
import { createAuthMiddleware } from "../middleware/authMiddleware.js";
import type { PasswordResetService } from "../services/passwordResetService.js";

export function createPasswordRouter(
  passwordResetService?: PasswordResetService,
  authMiddleware: RequestHandler = createAuthMiddleware(),
): Router {
  const router = Router();
  const controller = new PasswordController(passwordResetService);

  router.patch("/api/password/change", authMiddleware, controller.change);
  router.post("/api/password/reset-request", controller.requestReset);

  return router;
}
