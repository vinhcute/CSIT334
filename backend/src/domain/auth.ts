import type { AccountStatus, UserRole } from "@prisma/client";

export interface AuthenticatedUserPayload {
  userId: string;
  role: UserRole;
  accountStatus: AccountStatus;
}
