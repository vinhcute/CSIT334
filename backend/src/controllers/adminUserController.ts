import type { Request, Response } from "express";
import {
  AdminUserNotFoundError,
  AdminUserService,
} from "../services/adminUserService.js";
import { serializeSafeUser, serializeSafeUsers } from "../utils/safeUser.js";

export class AdminUserController {
  constructor(private readonly adminUserService = new AdminUserService()) {}

  index = async (_request: Request, response: Response): Promise<void> => {
    const users = await this.adminUserService.listUsers();
    response.json({ users: serializeSafeUsers(users) });
  };

  disable = async (request: Request, response: Response): Promise<void> => {
    const userId = request.params.id;

    if (typeof userId !== "string") {
      response.status(400).json({ error: "User ID is required." });
      return;
    }

    try {
      const user = await this.adminUserService.disableUser(userId);
      response.json({ user: serializeSafeUser(user) });
    } catch (error) {
      this.handleError(error, response);
    }
  };

  reactivate = async (request: Request, response: Response): Promise<void> => {
    const userId = request.params.id;

    if (typeof userId !== "string") {
      response.status(400).json({ error: "User ID is required." });
      return;
    }

    try {
      const user = await this.adminUserService.reactivateUser(userId);
      response.json({ user: serializeSafeUser(user) });
    } catch (error) {
      this.handleError(error, response);
    }
  };

  private handleError(error: unknown, response: Response): void {
    if (error instanceof AdminUserNotFoundError) {
      response.status(404).json({ error: error.message });
      return;
    }

    throw error;
  }
}
