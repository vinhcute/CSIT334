import type { Request, Response } from "express";
import { UserRepository } from "../repositories/userRepository.js";
import { serializeSafeUser } from "../utils/safeUser.js";
import { z } from "zod";

const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120, "Name cannot exceed 120 characters."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Email must be a valid email address.")
    .max(255, "Email cannot exceed 255 characters."),
  universityId: z
    .string()
    .trim()
    .min(1, "University ID is required.")
    .max(40, "University ID cannot exceed 40 characters."),
});

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

  updateMe = async (request: Request, response: Response): Promise<void> => {
    if (!request.user) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }

    const parsed = updateProfileSchema.safeParse(request.body);

    if (!parsed.success) {
      response.status(400).json({ error: parsed.error.issues[0]?.message ?? "Profile input is invalid." });
      return;
    }

    const existingEmailUser = await this.userRepository.findByEmail(parsed.data.email);

    if (existingEmailUser && existingEmailUser.id !== request.user.userId) {
      response.status(409).json({ error: "Email is already in use." });
      return;
    }

    const existingUniversityUser = await this.userRepository.findByUniversityId(
      parsed.data.universityId,
    );

    if (existingUniversityUser && existingUniversityUser.id !== request.user.userId) {
      response.status(409).json({ error: "University ID is already in use." });
      return;
    }

    const user = await this.userRepository.updateProfile(request.user.userId, parsed.data);

    response.json({ user: serializeSafeUser(user) });
  };
}
