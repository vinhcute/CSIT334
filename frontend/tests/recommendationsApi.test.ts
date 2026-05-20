import { describe, expect, it, vi } from "vitest";
import { createApiClient, type TokenStore } from "../src/services/apiClient.js";
import { createRecommendationsApi } from "../src/services/recommendationsApi.js";

function createMemoryTokenStore(token = "recommendation-token"): TokenStore {
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

function expectAuthHeader(fetchCall: Parameters<typeof fetch>) {
  const headers = fetchCall[1]?.headers as Headers;

  expect(headers.get("authorization")).toBe("Bearer recommendation-token");
}

describe("recommendations API client", () => {
  it("loads nearest available zone with bearer authorization", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ recommendation: null }),
    ) as unknown as typeof fetch;
    const recommendationsApi = createRecommendationsApi(createTestClient(fetchImpl));

    await recommendationsApi.getNearestZone();

    const fetchCall = vi.mocked(fetchImpl).mock.calls[0] as unknown as Parameters<typeof fetch>;
    expect(fetchCall[0]).toBe("/api/recommendations/nearest-zone");
    expect(fetchCall[1]?.method).toBe("GET");
    expectAuthHeader(fetchCall);
  });

  it("loads least congested zone with bearer authorization", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ recommendation: null }),
    ) as unknown as typeof fetch;
    const recommendationsApi = createRecommendationsApi(createTestClient(fetchImpl));

    await recommendationsApi.getLeastCongestedZone();

    const fetchCall = vi.mocked(fetchImpl).mock.calls[0] as unknown as Parameters<typeof fetch>;
    expect(fetchCall[0]).toBe("/api/recommendations/least-congested-zone");
    expect(fetchCall[1]?.method).toBe("GET");
    expectAuthHeader(fetchCall);
  });

  it("loads combined zone recommendations with bearer authorization", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        recommendations: {
          nearestAvailableZone: null,
          leastCongestedZone: null,
          recommendations: [],
          generatedAt: "2026-05-20T00:00:00.000Z",
        },
      }),
    ) as unknown as typeof fetch;
    const recommendationsApi = createRecommendationsApi(createTestClient(fetchImpl));

    await recommendationsApi.getZoneRecommendations();

    const fetchCall = vi.mocked(fetchImpl).mock.calls[0] as unknown as Parameters<typeof fetch>;
    expect(fetchCall[0]).toBe("/api/recommendations/zones");
    expect(fetchCall[1]?.method).toBe("GET");
    expectAuthHeader(fetchCall);
  });
});
