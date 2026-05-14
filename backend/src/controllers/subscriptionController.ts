import type { Request, Response } from "express";
import {
  SubscriptionService,
  SubscriptionValidationError,
} from "../services/subscriptionService.js";

export class SubscriptionController {
  constructor(private readonly subscriptionService = new SubscriptionService()) {}

  create = async (request: Request, response: Response): Promise<void> => {
    if (!request.user) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }

    try {
      const result = await this.subscriptionService.createOrRenew(
        request.user.userId,
        request.body,
      );
      response.status(201).json(result);
    } catch (error) {
      if (error instanceof SubscriptionValidationError) {
        response.status(400).json({ error: error.message, issues: error.issues });
        return;
      }

      throw error;
    }
  };
}
