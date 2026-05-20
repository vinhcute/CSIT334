import { describe, expect, it, vi } from "vitest";
import { createApiClient, type TokenStore } from "../src/services/apiClient.js";
import { createPredictiveAvailabilityApi } from "../src/services/predictiveAvailabilityApi.js";

function createMemoryTokenStore(token = "prediction-token"): TokenStore {
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

describe("predictive availability API client", () => {
  it("requests predictions with bearer authorization and encoded query params", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        prediction: {
          zoneId: "zone-a",
          zoneName: "North Zone",
          targetTime: "2026-05-27T07:30:00.000Z",
          capacity: 100,
          predictedAvailableSpots: 42,
          predictedOccupancyRate: 58,
          availabilityProbability: 42,
          confidenceLabel: "medium",
          historicalSampleCount: 4,
          basis: "Based on 4 historical samples from the same weekday and hour.",
        },
      }),
    ) as unknown as typeof fetch;
    const predictiveAvailabilityApi = createPredictiveAvailabilityApi(
      createTestClient(fetchImpl),
    );

    await predictiveAvailabilityApi.predictAvailability({
      zoneId: "zone-a",
      targetTime: "2026-05-27T07:30:00.000Z",
    });

    const fetchCall = vi.mocked(fetchImpl).mock.calls[0] as unknown as Parameters<typeof fetch>;
    const headers = fetchCall[1]?.headers as Headers;
    const url = new URL(fetchCall[0] as string, "http://localhost");

    expect(url.pathname).toBe("/api/predictive-availability");
    expect(url.searchParams.get("zoneId")).toBe("zone-a");
    expect(url.searchParams.get("targetTime")).toBe("2026-05-27T07:30:00.000Z");
    expect(fetchCall[1]?.method).toBe("GET");
    expect(headers.get("authorization")).toBe("Bearer prediction-token");
  });
});
