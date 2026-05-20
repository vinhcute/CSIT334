import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma as defaultPrisma } from "../config/database.js";
import { UserRepository } from "../repositories/userRepository.js";
import { MIN_PASSWORD_LENGTH, PasswordService } from "./passwordService.js";

const registrationSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  universityId: z.string().trim().min(1, "University ID is required."),
  email: z.string().trim().email("A valid email is required.").transform((value) => value.toLowerCase()),
  password: z.string().min(MIN_PASSWORD_LENGTH),
  licensePlate: z.string().trim().min(1, "Licence plate is required."),
  vehicleMake: z.string().trim().optional(),
  vehicleModel: z.string().trim().optional(),
  vehicleColor: z.string().trim().optional(),
});

export type RegisterDriverInput = z.input<typeof registrationSchema>;

export class RegistrationValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super("Registration input is invalid.");
    this.name = "RegistrationValidationError";
  }
}

export class DuplicateRegistrationError extends Error {
  constructor(public readonly field: "email" | "universityId" | "licensePlate") {
    super(`A user or vehicle with this ${field} already exists.`);
    this.name = "DuplicateRegistrationError";
  }
}

export class RegistrationService {
  constructor(
    private readonly userRepository = new UserRepository(),
    private readonly passwordService = new PasswordService(),
    private readonly prisma: PrismaClient = defaultPrisma,
  ) {}

  async registerDriver(input: RegisterDriverInput) {
    const parsed = registrationSchema.safeParse(input);

    if (!parsed.success) {
      throw new RegistrationValidationError(parsed.error.issues.map((issue) => issue.message));
    }

    const existingEmail = await this.userRepository.findByEmail(parsed.data.email);
    if (existingEmail) {
      throw new DuplicateRegistrationError("email");
    }

    const existingUniversityId = await this.userRepository.findByUniversityId(parsed.data.universityId);
    if (existingUniversityId) {
      throw new DuplicateRegistrationError("universityId");
    }

    const existingVehicle = await this.prisma.vehicleProfile.findUnique({
      where: { licensePlate: parsed.data.licensePlate },
      select: { id: true },
    });
    if (existingVehicle) {
      throw new DuplicateRegistrationError("licensePlate");
    }

    const passwordHash = await this.passwordService.hashPassword(parsed.data.password);

    return this.userRepository.createDriverWithVehicle({
      name: parsed.data.name,
      email: parsed.data.email,
      universityId: parsed.data.universityId,
      passwordHash,
      licensePlate: parsed.data.licensePlate,
      vehicleMake: parsed.data.vehicleMake,
      vehicleModel: parsed.data.vehicleModel,
      vehicleColor: parsed.data.vehicleColor,
    });
  }
}
