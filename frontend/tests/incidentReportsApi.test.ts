import { describe, expect, it, vi } from "vitest";
import { createApiClient, type TokenStore } from "../src/services/apiClient.js";
import { createIncidentReportsApi } from "../src/services/incidentReportsApi.js";

function createMemoryTokenStore(token = "incident-token"): TokenStore {
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

describe("incident reports API client", () => {
  it("submits report with bearer authorization", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        incidentReport: { id: "incident-1" },
      }),
    ) as unknown as typeof fetch;
    const incidentReportsApi = createIncidentReportsApi(createTestClient(fetchImpl));

    await incidentReportsApi.createReport({
      issueType: "spotDiscrepancy",
      description: "The spot was marked available but a vehicle was parked there.",
      spotId: "spot-1",
    });

    const fetchCall = vi.mocked(fetchImpl).mock.calls[0] as unknown as Parameters<typeof fetch>;
    const headers = fetchCall[1]?.headers as Headers;
    const body = JSON.parse(fetchCall[1]?.body as string) as {
      issueType: string;
      description: string;
      spotId: string;
    };

    expect(fetchCall[0]).toBe("/api/incident-reports");
    expect(fetchCall[1]?.method).toBe("POST");
    expect(headers.get("authorization")).toBe("Bearer incident-token");
    expect(body.issueType).toBe("spotDiscrepancy");
    expect(body.spotId).toBe("spot-1");
  });

  it("loads my reports with bearer authorization", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        incidentReports: [],
      }),
    ) as unknown as typeof fetch;
    const incidentReportsApi = createIncidentReportsApi(createTestClient(fetchImpl));

    await incidentReportsApi.listMyReports();

    const fetchCall = vi.mocked(fetchImpl).mock.calls[0] as unknown as Parameters<typeof fetch>;
    const headers = fetchCall[1]?.headers as Headers;

    expect(fetchCall[0]).toBe("/api/incident-reports/me");
    expect(fetchCall[1]?.method).toBe("GET");
    expect(headers.get("authorization")).toBe("Bearer incident-token");
  });

  it("loads admin reports with encoded filter query", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        incidentReports: [],
      }),
    ) as unknown as typeof fetch;
    const incidentReportsApi = createIncidentReportsApi(createTestClient(fetchImpl));

    await incidentReportsApi.listAdminReports({
      status: "open",
      issueType: "sensorFault",
      spotId: "spot-1",
    });

    const fetchCall = vi.mocked(fetchImpl).mock.calls[0] as unknown as Parameters<typeof fetch>;
    const headers = fetchCall[1]?.headers as Headers;
    const url = new URL(fetchCall[0] as string, "http://localhost");

    expect(url.pathname).toBe("/api/admin/incident-reports");
    expect(url.searchParams.get("status")).toBe("open");
    expect(url.searchParams.get("issueType")).toBe("sensorFault");
    expect(url.searchParams.get("spotId")).toBe("spot-1");
    expect(headers.get("authorization")).toBe("Bearer incident-token");
  });

  it("marks incident in review with bearer authorization", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        incidentReport: { id: "incident-1" },
      }),
    ) as unknown as typeof fetch;
    const incidentReportsApi = createIncidentReportsApi(createTestClient(fetchImpl));

    await incidentReportsApi.markInReview("incident-1");

    const fetchCall = vi.mocked(fetchImpl).mock.calls[0] as unknown as Parameters<typeof fetch>;
    const headers = fetchCall[1]?.headers as Headers;

    expect(fetchCall[0]).toBe("/api/admin/incident-reports/incident-1/in-review");
    expect(fetchCall[1]?.method).toBe("PATCH");
    expect(headers.get("authorization")).toBe("Bearer incident-token");
  });

  it("resolves incident with resolution payload", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        incidentReport: { id: "incident-1" },
      }),
    ) as unknown as typeof fetch;
    const incidentReportsApi = createIncidentReportsApi(createTestClient(fetchImpl));

    await incidentReportsApi.resolveReport("incident-1", {
      resolution: "Marked sensor for maintenance and reset state.",
    });

    const fetchCall = vi.mocked(fetchImpl).mock.calls[0] as unknown as Parameters<typeof fetch>;
    const headers = fetchCall[1]?.headers as Headers;
    const body = JSON.parse(fetchCall[1]?.body as string) as { resolution: string };

    expect(fetchCall[0]).toBe("/api/admin/incident-reports/incident-1/resolve");
    expect(fetchCall[1]?.method).toBe("PATCH");
    expect(headers.get("authorization")).toBe("Bearer incident-token");
    expect(body.resolution).toContain("maintenance");
  });
});
