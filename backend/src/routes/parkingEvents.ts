import { Router, type RequestHandler } from "express";
import { createAuthMiddleware } from "../middleware/authMiddleware.js";
import { parkingEvents } from "../realtime/parkingEvents.js";

export function createParkingEventsRouter(
  authMiddleware: RequestHandler = createAuthMiddleware(),
): Router {
  const router = Router();

  router.get("/api/parking-events", authMiddleware, (request, response) => {
    const unsubscribe = parkingEvents.subscribe(response);

    request.on("close", unsubscribe);
  });

  return router;
}
