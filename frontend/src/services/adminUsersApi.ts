import type { AccountStatus, SafeUser, UserRole } from "../features/auth/authTypes.js";
import { createApiClient } from "./apiClient.js";

export interface AdminUserSummary {
  id: string;
  name?: string;
  email: string;
  universityId?: string;
  role: UserRole;
  accountStatus: AccountStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminUsersResponse {
  users: AdminUserSummary[];
}

export interface AdminUserResponse {
  user: AdminUserSummary;
  message?: string;
}

export type AdminUsersApiClient = ReturnType<typeof createApiClient>;

export function toAdminUserSummary(user: SafeUser): AdminUserSummary {
  const {
    id,
    name,
    email,
    universityId,
    role,
    accountStatus,
    createdAt,
    updatedAt,
  } = user;

  return {
    id,
    name,
    email,
    universityId,
    role,
    accountStatus,
    createdAt,
    updatedAt,
  };
}

export function createAdminUsersApi(apiClient: AdminUsersApiClient = createApiClient()) {
  return {
    listUsers(): Promise<AdminUsersResponse> {
      return apiClient.request<AdminUsersResponse>("/api/admin/users", {
        authenticated: true,
      });
    },

    disableUser(userId: string): Promise<AdminUserResponse> {
      return apiClient.request<AdminUserResponse>(`/api/admin/users/${userId}/disable`, {
        method: "PATCH",
        authenticated: true,
      });
    },

    reactivateUser(userId: string): Promise<AdminUserResponse> {
      return apiClient.request<AdminUserResponse>(`/api/admin/users/${userId}/reactivate`, {
        method: "PATCH",
        authenticated: true,
      });
    },
  };
}
