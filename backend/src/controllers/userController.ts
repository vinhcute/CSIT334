import type { Request, Response } from "express";
import { UserRepository } from "../repositories/userRepository.js";
import { serializeSafeUser } from "../utils/safeUser.js";

export class UserController {
  constructor(private readonly userRepository = new UserRepository()) {}

  me = async (request: Request, response: Response): Promise<void> => {
    if (!request.user) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }

    const user = await this.userRepository.findById(request.user.userId);

    if (!user) {
      response.status(404).json({ error: "User not found." });
      return;
    }

    response.json({ user: serializeSafeUser(user) });
  };
}
