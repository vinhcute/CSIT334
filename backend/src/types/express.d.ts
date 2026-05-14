import type { AuthenticatedUserPayload } from "../domain/auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUserPayload;
    }
  }
}

export {};
