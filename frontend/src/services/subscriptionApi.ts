import { createApiClient } from "./apiClient.js";

export type SubscriptionType = "daily" | "weekly" | "monthly";
export type SubscriptionStatus = "active" | "expired" | "cancelled" | "pending";

export interface Subscription {
  id: string;
  userId: string;
  type: SubscriptionType;
  status: SubscriptionStatus;
  startTime: string;
  endTime: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriptionResponse {
  subscription: Subscription;
  message: string;
}

export type SubscriptionApiClient = ReturnType<typeof createApiClient>;

export function createSubscriptionApi(
  apiClient: SubscriptionApiClient = createApiClient(),
) {
  return {
    createSubscription(type: SubscriptionType): Promise<CreateSubscriptionResponse> {
      return apiClient.request<CreateSubscriptionResponse>("/api/subscriptions", {
        method: "POST",
        body: { type },
        authenticated: true,
      });
    },
  };
}
