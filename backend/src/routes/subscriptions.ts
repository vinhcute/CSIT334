import { Router, type RequestHandler } from "express";
import { SubscriptionController } from "../controllers/subscriptionController.js";
import { createAuthMiddleware } from "../middleware/authMiddleware.js";
import type { SubscriptionService } from "../services/subscriptionService.js";

export function createSubscriptionsRouter(
  subscriptionService?: SubscriptionService,
  authMiddleware: RequestHandler = createAuthMiddleware(),
): Router {
  const router = Router();
  const controller = new SubscriptionController(subscriptionService);

  router.post("/api/subscriptions", authMiddleware, controller.create);

  return router;
}
