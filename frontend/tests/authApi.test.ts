import { describe, expect, it, vi } from "vitest";
import { createApiClient, type TokenStore } from "../src/services/apiClient.js";
import { createAuthApi } from "../src/services/authApi.js";

function createMemoryTokenStore(initialToken: string | null = null): TokenStore {
  let token = initialToken;

  return {
    getToken: () => token,
    setToken: (nextToken) => {
      token = nextToken;
    },
    clearToken: () => {
      token = null;
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("auth API client", () => {
  it("sends the expected registration request body", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ user: { id: "user-1" } }));
    const apiClient = createApiClient({
      baseUrl: "http://api.test",
      fetchImpl,
      tokenStore: createMemoryTokenStore(),
    });
    const authApi = createAuthApi(apiClient);
    const input = {
      name: "Test Driver",
      universityId: "UOW001",
      email: "driver@example.test",
      password: "password-value",
      licensePlate: "ABC-123",
    };

    await authApi.register(input);

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://api.test/api/auth/register",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  });

  it("sends the expected login request body and stores the returned token", async () => {
    const tokenStore = createMemoryTokenStore();
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        token: "signed-token",
        user: {
          id: "user-1",
          email: "driver@example.test",
          role: "driver",
          accountStatus: "active",
        },
      }),
    );
    const apiClient = createApiClient({
      fetchImpl,
      tokenStore,
    });
    const authApi = createAuthApi(apiClient);
    const input = {
      email: "driver@example.test",
      password: "password-value",
    };

    await authApi.login(input);

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
    expect(tokenStore.getToken()).toBe("signed-token");
  });

  it("attaches bearer tokens to authenticated requests", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        user: {
          id: "user-1",
          email: "driver@example.test",
          role: "driver",
          accountStatus: "active",
        },
      }),
    );
    const apiClient = createApiClient({
      fetchImpl,
      tokenStore: createMemoryTokenStore("stored-token"),
    });
    const authApi = createAuthApi(apiClient);

    await authApi.getCurrentUser();

    const fetchCall = fetchImpl.mock.calls[0] as unknown as Parameters<typeof fetch>;
    const headers = fetchCall[1]?.headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer stored-token");
  });

  it("clears token state after logout", async () => {
    const tokenStore = createMemoryTokenStore("stored-token");
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        success: true,
        strategy: "clientTokenDiscard",
      }),
    );
    const apiClient = createApiClient({
      fetchImpl,
      tokenStore,
    });
    const authApi = createAuthApi(apiClient);

    await authApi.logout();

    expect(tokenStore.getToken()).toBeNull();
  });

  it("clears token state after a 401", async () => {
    const tokenStore = createMemoryTokenStore("expired-token");
    const onUnauthorized = vi.fn();
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "Authentication required." }, 401));
    const apiClient = createApiClient({
      fetchImpl,
      tokenStore,
      onUnauthorized,
    });
    const authApi = createAuthApi(apiClient);

    await expect(authApi.getCurrentUser()).rejects.toThrow("API request failed with status 401.");

    expect(tokenStore.getToken()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("reports a clear error when the API returns HTML instead of JSON", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("<!DOCTYPE html><html></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    const apiClient = createApiClient({
      fetchImpl,
      tokenStore: createMemoryTokenStore(),
    });
    const authApi = createAuthApi(apiClient);

    await expect(
      authApi.login({ email: "driver@example.test", password: "password-value" }),
    ).rejects.toThrow("The API returned an unexpected non-JSON response.");
  });
});
