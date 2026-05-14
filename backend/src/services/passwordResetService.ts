import { z } from "zod";
import { UserRepository } from "../repositories/userRepository.js";
import {
  PasswordService,
  PasswordValidationError,
} from "./passwordService.js";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string().min(1, "New password is required."),
});

const resetRequestSchema = z.object({
  email: z.string().trim().email("A valid email is required.").transform((value) => value.toLowerCase()),
});

const simulatedResetResponse = {
  success: true,
  message: "If an account exists for that email, a simulated reset instruction has been recorded.",
  simulated: true,
  emailSent: false,
} as const;

export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
export type ResetPasswordRequestInput = z.input<typeof resetRequestSchema>;

export class PasswordChangeValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super("Password change input is invalid.");
    this.name = "PasswordChangeValidationError";
  }
}

export class InvalidCurrentPasswordError extends Error {
  constructor() {
    super("Current password is incorrect.");
    this.name = "InvalidCurrentPasswordError";
  }
}

export class PasswordResetService {
  constructor(
    private readonly userRepository = new UserRepository(),
    private readonly passwordService = new PasswordService(),
  ) {}

  async changePassword(userId: string, input: ChangePasswordInput) {
    const parsed = changePasswordSchema.safeParse(input);

    if (!parsed.success) {
      throw new PasswordChangeValidationError(parsed.error.issues.map((issue) => issue.message));
    }

    const authRecord = await this.userRepository.findAuthRecordById(userId);

    if (!authRecord) {
      throw new InvalidCurrentPasswordError();
    }

    const currentPasswordMatches = await this.passwordService.verifyPassword(
      parsed.data.currentPassword,
      authRecord.passwordHash,
    );

    if (!currentPasswordMatches) {
      throw new InvalidCurrentPasswordError();
    }

    try {
      const passwordHash = await this.passwordService.hashPassword(parsed.data.newPassword);
      await this.userRepository.updatePasswordHash(userId, passwordHash);
    } catch (error) {
      if (error instanceof PasswordValidationError) {
        throw new PasswordChangeValidationError([error.message]);
      }

      throw error;
    }

    return { success: true };
  }

  async requestReset(input: ResetPasswordRequestInput) {
    const parsed = resetRequestSchema.safeParse(input);

    if (!parsed.success) {
      throw new PasswordChangeValidationError(parsed.error.issues.map((issue) => issue.message));
    }

    await this.userRepository.findByEmail(parsed.data.email);

    return simulatedResetResponse;
  }
}
