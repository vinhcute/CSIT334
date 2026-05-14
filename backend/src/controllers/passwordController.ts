import type { Request, Response } from "express";
import {
  InvalidCurrentPasswordError,
  PasswordChangeValidationError,
  PasswordResetService,
} from "../services/passwordResetService.js";

export class PasswordController {
  constructor(private readonly passwordResetService = new PasswordResetService()) {}

  change = async (request: Request, response: Response): Promise<void> => {
    if (!request.user) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }

    try {
      const result = await this.passwordResetService.changePassword(
        request.user.userId,
        request.body,
      );
      response.json(result);
    } catch (error) {
      if (error instanceof InvalidCurrentPasswordError) {
        response.status(401).json({ error: error.message });
        return;
      }

      if (error instanceof PasswordChangeValidationError) {
        response.status(400).json({ error: error.message, issues: error.issues });
        return;
      }

      throw error;
    }
  };

  requestReset = async (request: Request, response: Response): Promise<void> => {
    try {
      const result = await this.passwordResetService.requestReset(request.body);
      response.json(result);
    } catch (error) {
      if (error instanceof PasswordChangeValidationError) {
        response.status(400).json({ error: error.message, issues: error.issues });
        return;
      }

      throw error;
    }
  };
}
