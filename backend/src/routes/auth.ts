import { Router } from "express";
import { AuthController } from "../controllers/authController.js";
import type { AuthService } from "../services/authService.js";
import type { RegistrationService } from "../services/registrationService.js";

export function createAuthRouter(
  authService?: AuthService,
  registrationService?: RegistrationService,
): Router {
  const router = Router();
  const controller = new AuthController(authService, registrationService);

  router.post("/api/auth/register", controller.register);
  router.post("/api/auth/login", controller.login);
  router.post("/api/auth/logout", controller.logout);

  return router;
}
