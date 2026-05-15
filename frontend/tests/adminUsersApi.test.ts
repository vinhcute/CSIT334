import { describe, expect, it, vi } from "vitest";
import { createApiClient, type TokenStore } from "../src/services/apiClient.js";
import {
  createAdminUsersApi,
  toAdminUserSummary,
} from "../src/services/adminUsersApi.js";

function createMemoryTokenStore(token = "admin-token"): TokenStore {
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

describe("admin users API client", () => {
  it("loads user summaries with bearer authorization", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        users: [
          {
            id: "user-1",
            name: "Admin User",
            email: "admin@example.test",
            role: "admin",
            accountStatus: "active",
          },
        ],
      }),
    ) as unknown as typeof fetch;
    const adminUsersApi = createAdminUsersApi(createTestClient(fetchImpl));

    await adminUsersApi.listUsers();

    const fetchCall = vi.mocked(fetchImpl).mock.calls[0] as unknown as Parameters<typeof fetch>;
    const headers = fetchCall[1]?.headers as Headers;
    expect(fetchCall[0]).toBe("/api/admin/users");
    expect(headers.get("authorization")).toBe("Bearer admin-token");
  });

  it("disables and reactivates accounts with PATCH requests", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        user: {
          id: "user-1",
          email: "driver@example.test",
          role: "driver",
          accountStatus: "disabled",
        },
      }),
    ) as unknown as typeof fetch;
    const adminUsersApi = createAdminUsersApi(createTestClient(fetchImpl));

    await adminUsersApi.disableUser("user-1");
    await adminUsersApi.reactivateUser("user-1");

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "/api/admin/users/user-1/disable",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "/api/admin/users/user-1/reactivate",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("keeps password hashes out of admin summaries", () => {
    const summary = toAdminUserSummary({
      id: "user-1",
      name: "Driver User",
      email: "driver@example.test",
      role: "driver",
      accountStatus: "active",
      vehicleProfiles: [],
    });

    expect(summary).not.toHaveProperty("passwordHash");
  });
});
