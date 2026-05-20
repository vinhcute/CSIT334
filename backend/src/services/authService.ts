import type { AccountStatus, UserRole } from "@prisma/client";
import { getEnv } from "../config/env.js";
import { UserRepository } from "../repositories/userRepository.js";
import { PasswordService } from "./passwordService.js";
import { TokenService } from "./tokenService.js";

export interface LoginInput {
  email: string;
  password: string;
}

export interface SafeAuthUser {
  id: string;
  email: string;
  role: UserRole;
  accountStatus: AccountStatus;
}

export interface LoginResult {
  token: string;
  user: SafeAuthUser;
}

export interface LogoutResult {
  success: true;
  strategy: "clientTokenDiscard";
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Email or password is incorrect.");
    this.name = "InvalidCredentialsError";
  }
}

export class AccountDisabledError extends Error {
  constructor() {
    super("This account is disabled.");
    this.name = "AccountDisabledError";
  }
}

export class AuthService {
  constructor(
    private readonly userRepository = new UserRepository(),
    private readonly passwordService = new PasswordService(),
    private readonly tokenService?: TokenService,
  ) {}

  async login(input: LoginInput): Promise<LoginResult> {
    const email = input.email.trim().toLowerCase();
    const authRecord = await this.userRepository.findAuthRecordByEmail(email);

    if (!authRecord) {
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await this.passwordService.verifyPassword(
      input.password,
      authRecord.passwordHash,
    );

    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }

    if (authRecord.accountStatus === "disabled") {
      throw new AccountDisabledError();
    }

    const user = {
      id: authRecord.id,
      email: authRecord.email,
      role: authRecord.role,
      accountStatus: authRecord.accountStatus,
    };

    return {
      token: this.getTokenService().signToken({
        userId: authRecord.id,
        role: authRecord.role,
        accountStatus: authRecord.accountStatus,
      }),
      user,
    };
  }

  logout(): LogoutResult {
    return {
      success: true,
      strategy: "clientTokenDiscard",
    };
  }

  private getTokenService(): TokenService {
    return (
      this.tokenService ??
      new TokenService({
        secret: getEnv().authTokenSecret ?? "",
        expiresIn: getEnv().authTokenExpiresIn,
      })
    );
  }
}
