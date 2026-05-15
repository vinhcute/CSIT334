import { describe, expect, it, vi } from "vitest";
import { createAccountApi } from "../src/services/accountApi.js";
import { createApiClient, type TokenStore } from "../src/services/apiClient.js";
import { createSubscriptionApi } from "../src/services/subscriptionApi.js";

function createMemoryTokenStore(token = "stored-token"): TokenStore {
  return {
    getToken: () => token,
    setToken: (nextToken) => {
      token = nextToken;
    },
    clearToken: () => {
      token = "";
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createTestClient(fetchImpl: typeof fetch) {
  return createApiClient({
    fetchImpl,
    tokenStore: createMemoryTokenStore(),
  });
}

describe("account API client", () => {
  it("loads current profile with bearer authorization", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        user: {
          id: "user-1",
          name: "Test Driver",
          email: "driver@example.test",
          role: "driver",
          accountStatus: "active",
        },
      }),
    ) as unknown as typeof fetch;
    const accountApi = createAccountApi(createTestClient(fetchImpl));

    await accountApi.getCurrentProfile();

    const fetchCall = vi.mocked(fetchImpl).mock.calls[0] as unknown as Parameters<typeof fetch>;
    const headers = fetchCall[1]?.headers as Headers;
    expect(fetchCall[0]).toBe("/api/users/me");
    expect(headers.get("authorization")).toBe("Bearer stored-token");
  });

  it("creates vehicle profiles with the expected request body", async () => {
    const input = {
      licensePlate: "ABC-123",
      vehicleMake: "Toyota",
      vehicleModel: "Corolla",
      vehicleColor: "White",
    };
    const fetchImpl = vi.fn(async () => jsonResponse({ vehicleProfile: { id: "vehicle-1", ...input } })) as unknown as typeof fetch;
    const accountApi = createAccountApi(createTestClient(fetchImpl));

    await accountApi.createVehicleProfile(input);

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/vehicle-profiles",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  });

  it("updates vehicle profiles with the expected endpoint", async () => {
    const input = {
      licensePlate: "ABC-456",
    };
    const fetchImpl = vi.fn(async () => jsonResponse({ vehicleProfile: { id: "vehicle-1", ...input } })) as unknown as typeof fetch;
    const accountApi = createAccountApi(createTestClient(fetchImpl));

    await accountApi.updateVehicleProfile("vehicle-1", input);

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/vehicle-profiles/vehicle-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    );
  });
});

describe("subscription API client", () => {
  it("creates a simulated monthly subscription request", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        subscription: {
          id: "subscription-1",
          type: "monthly",
          status: "active",
        },
        message: "Simulated subscription activated; no payment was processed.",
      }),
    ) as unknown as typeof fetch;
    const subscriptionApi = createSubscriptionApi(createTestClient(fetchImpl));

    await subscriptionApi.createSubscription("monthly");

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/subscriptions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ type: "monthly" }),
      }),
    );
  });
});
