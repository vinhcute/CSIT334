import type { UserRole } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";

export function requireRole(role: UserRole) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (!request.user) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }

    if (request.user.role !== role) {
      response.status(403).json({ error: "Forbidden." });
      return;
    }

    next();
  };
}
