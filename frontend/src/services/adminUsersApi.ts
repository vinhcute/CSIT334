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
  subscription: AdminUserSubscriptionSummary;
}

export interface AdminUserSubscriptionSummary {
  status: "subscribed" | "notSubscribed";
  endTime: string | null;
}

export interface AdminUsersResponse {
  users: AdminUserSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminUsersFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: UserRole;
  accountStatus?: AccountStatus;
  subscriptionStatus?: "subscribed" | "notSubscribed";
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
    subscription:
      "subscription" in user &&
      typeof user.subscription === "object" &&
      user.subscription !== null
        ? (user.subscription as AdminUserSubscriptionSummary)
        : { status: "notSubscribed", endTime: null },
  };
}

export function createAdminUsersApi(apiClient: AdminUsersApiClient = createApiClient()) {
  return {
    listUsers(filters: AdminUsersFilters = {}): Promise<AdminUsersResponse> {
      return apiClient.request<AdminUsersResponse>(buildAdminUsersPath(filters), {
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

function buildAdminUsersPath(filters: AdminUsersFilters): string {
  const searchParams = new URLSearchParams();

  if (filters.page) {
    searchParams.set("page", String(filters.page));
  }

  if (filters.pageSize) {
    searchParams.set("pageSize", String(filters.pageSize));
  }

  if (filters.search) {
    searchParams.set("search", filters.search);
  }

  if (filters.role) {
    searchParams.set("role", filters.role);
  }

  if (filters.accountStatus) {
    searchParams.set("accountStatus", filters.accountStatus);
  }

  if (filters.subscriptionStatus) {
    searchParams.set("subscriptionStatus", filters.subscriptionStatus);
  }

  const query = searchParams.toString();

  return `/api/admin/users${query ? `?${query}` : ""}`;
}
