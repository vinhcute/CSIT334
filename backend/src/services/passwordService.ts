import bcrypt from "bcryptjs";

export const MIN_PASSWORD_LENGTH = 8;

export class PasswordValidationError extends Error {
  constructor(message = `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`) {
    super(message);
    this.name = "PasswordValidationError";
  }
}

export class PasswordService {
  constructor(private readonly saltRounds = 12) {}

  async hashPassword(password: string): Promise<string> {
    this.validatePassword(password);

    return bcrypt.hash(password, this.saltRounds);
  }

  async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }

  validatePassword(password: string): void {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new PasswordValidationError();
    }
  }
}
