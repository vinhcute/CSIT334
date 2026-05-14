import type { NextFunction, Request, Response } from "express";
import { getEnv } from "../config/env.js";
import { TokenService, TokenVerificationError } from "../services/tokenService.js";

const AUTH_REQUIRED_RESPONSE = { error: "Authentication required." };

export function createAuthMiddleware(tokenService?: TokenService) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const token = getBearerToken(request);

    if (!token) {
      response.status(401).json(AUTH_REQUIRED_RESPONSE);
      return;
    }

    try {
      const verifier =
        tokenService ??
        new TokenService({
          secret: getEnv().authTokenSecret ?? "",
          expiresIn: getEnv().authTokenExpiresIn,
        });
      request.user = verifier.verifyToken(token);
      next();
    } catch (error) {
      if (error instanceof TokenVerificationError) {
        response.status(401).json(AUTH_REQUIRED_RESPONSE);
        return;
      }

      throw error;
    }
  };
}

function getBearerToken(request: Request): string | null {
  const authorization = request.header("authorization");

  if (!authorization) {
    return null;
  }

  const [scheme, token, extra] = authorization.split(" ");

  if (scheme !== "Bearer" || !token || extra) {
    return null;
  }

  return token;
}
