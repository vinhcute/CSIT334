import type { Request, Response } from "express";
import {
  AuthService,
  AccountDisabledError,
  InvalidCredentialsError,
} from "../services/authService.js";
import {
  DuplicateRegistrationError,
  RegistrationService,
  RegistrationValidationError,
} from "../services/registrationService.js";
import { serializeSafeUser } from "../utils/safeUser.js";

export class AuthController {
  constructor(
    private readonly authService = new AuthService(),
    private readonly registrationService = new RegistrationService(),
  ) {}

  register = async (request: Request, response: Response): Promise<void> => {
    try {
      const user = await this.registrationService.registerDriver(request.body);
      response.status(201).json({ user: serializeSafeUser(user) });
    } catch (error) {
      if (error instanceof RegistrationValidationError) {
        response.status(400).json({ error: error.message, issues: error.issues });
        return;
      }

      if (error instanceof DuplicateRegistrationError) {
        response.status(409).json({ error: error.message, field: error.field });
        return;
      }

      throw error;
    }
  };

  login = async (request: Request, response: Response): Promise<void> => {
    try {
      const result = await this.authService.login(request.body);
      response.json({
        token: result.token,
        user: serializeSafeUser(result.user),
      });
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        response.status(401).json({ error: error.message });
        return;
      }

      if (error instanceof AccountDisabledError) {
        response.status(403).json({ error: error.message });
        return;
      }

      throw error;
    }
  };

  logout = (_request: Request, response: Response): void => {
    response.json(this.authService.logout());
  };
}
