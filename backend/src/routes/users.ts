import { Router, type RequestHandler } from "express";
import { UserController } from "../controllers/userController.js";
import { createAuthMiddleware } from "../middleware/authMiddleware.js";
import type { UserRepository } from "../repositories/userRepository.js";

export function createUsersRouter(
  userRepository?: UserRepository,
  authMiddleware: RequestHandler = createAuthMiddleware(),
): Router {
  const router = Router();
  const controller = new UserController(userRepository);

  router.get("/api/users/me", authMiddleware, controller.me);
  router.patch("/api/users/me", authMiddleware, controller.updateMe);

  return router;
}
