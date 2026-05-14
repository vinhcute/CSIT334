import jwt, { type SignOptions } from "jsonwebtoken";
import { AccountStatus, UserRole } from "../domain/enums.js";
import type { AuthenticatedUserPayload } from "../domain/auth.js";

export class TokenVerificationError extends Error {
  constructor(message = "Authentication token is invalid or expired.") {
    super(message);
    this.name = "TokenVerificationError";
  }
}

export interface TokenServiceOptions {
  secret: string;
  expiresIn: string;
}

export class TokenService {
  constructor(private readonly options: TokenServiceOptions) {
    if (!options.secret) {
      throw new Error("Token secret is required.");
    }
  }

  signToken(payload: AuthenticatedUserPayload): string {
    return jwt.sign(payload, this.options.secret, {
      expiresIn: this.options.expiresIn as SignOptions["expiresIn"],
    });
  }

  verifyToken(token: string): AuthenticatedUserPayload {
    try {
      const decoded = jwt.verify(token, this.options.secret);

      if (!this.isAuthenticatedUserPayload(decoded)) {
        throw new TokenVerificationError();
      }

      return decoded;
    } catch (error) {
      if (error instanceof TokenVerificationError) {
        throw error;
      }

      throw new TokenVerificationError();
    }
  }

  private isAuthenticatedUserPayload(value: unknown): value is AuthenticatedUserPayload {
    if (!value || typeof value !== "object") {
      return false;
    }

    const candidate = value as Partial<AuthenticatedUserPayload>;

    return (
      typeof candidate.userId === "string" &&
      Object.values(UserRole).includes(candidate.role as UserRole) &&
      Object.values(AccountStatus).includes(candidate.accountStatus as AccountStatus)
    );
  }
}
