import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, ApiResponseFormatError, createApiClient, type TokenStore } from "../src/services/apiClient.js";
import { createAnalyticsApi, type AnalyticsSummary } from "../src/services/analyticsApi.js";
import type { SafeUser } from "../src/features/auth/authTypes.js";
import {
  ANALYTICS_RANGE_OPTIONS,
  AdminAnalyticsPage,
  buildAnalyticsStatCards,
  canViewAdminAnalytics,
  formatAnalyticsTime,
  formatPercent,
  getAnalyticsErrorMessage,
  getAnalyticsRangeLabel,
  getTopPeakHours,
  getTrendWidth,
  getUtilisationWidth,
  hasAnalyticsData,
  isAnalyticsRange,
} from "../src/features/admin/AdminAnalyticsPage.js";

const adminUser: SafeUser = {
  id: "admin-1",
  email: "admin@example.test",
  role: "admin",
  accountStatus: "active",
};

const driverUser: SafeUser = {
  id: "driver-1",
  email: "driver@example.test",
  role: "driver",
  accountStatus: "active",
};

const summary: AnalyticsSummary = {
  range: "today",
  generatedAt: "2026-05-20T08:00:00.000Z",
  totalCapacity: 100,
  totalAvailableSpots: 32,
  totalOccupiedSpots: 40,
  totalReservedSpots: 20,
  totalMaintenanceRequiredSpots: 8,
  averageOccupancyRate: 60,
  openIncidentCount: null,
  occupancyTrends: [
    {
      recordedAt: "2026-05-20T08:00:00.000Z",
      zoneId: "zone-a",
      zoneName: "North Lot",
      capacity: 20,
      availableSpots: 8,
      occupiedSpots: 10,
      reservedSpots: 2,
      occupancyRate: 60,
    },
  ],
  peakHours: [
    { hour: 9, hourLabel: "9 AM", averageOccupancyRate: 88.5, sampleCount: 6 },
    { hour: 14, hourLabel: "2 PM", averageOccupancyRate: 72, sampleCount: 4 },
  ],
  zoneUtilisation: [
    {
      zoneId: "zone-a",
      zoneName: "North Lot",
      capacity: 20,
      availableSpots: 8,
      occupiedSpots: 10,
      reservedSpots: 2,
      maintenanceRequiredSpots: 1,
      utilisationRate: 60,
    },
  ],
};

function createMemoryTokenStore(token = "analytics-token"): TokenStore {
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

describe("admin analytics UI rules", () => {
  it("exports an admin analytics page", () => {
    const element = createElement(AdminAnalyticsPage);

    expect(element.type).toBe(AdminAnalyticsPage);
  });

  it("limits analytics to administrator accounts", () => {
    expect(canViewAdminAnalytics(adminUser)).toBe(true);
    expect(canViewAdminAnalytics(driverUser)).toBe(false);
    expect(canViewAdminAnalytics(null)).toBe(false);
  });

  it("supports expected range labels", () => {
    expect(ANALYTICS_RANGE_OPTIONS).toEqual(["today", "week", "month"]);
    expect(isAnalyticsRange("today")).toBe(true);
    expect(isAnalyticsRange("year")).toBe(false);
    expect(getAnalyticsRangeLabel("today")).toBe("Today");
    expect(getAnalyticsRangeLabel("week")).toBe("Last 7 days");
    expect(getAnalyticsRangeLabel("month")).toBe("Last 30 days");
  });

  it("builds summary cards and chart widths from analytics data", () => {
    expect(hasAnalyticsData(summary)).toBe(true);
    expect(
      hasAnalyticsData({
        ...summary,
        totalCapacity: 0,
        totalAvailableSpots: 0,
        totalOccupiedSpots: 0,
        totalReservedSpots: 0,
        totalMaintenanceRequiredSpots: 0,
        averageOccupancyRate: 0,
        occupancyTrends: [],
        peakHours: [],
        zoneUtilisation: [],
      }),
    ).toBe(false);
    expect(buildAnalyticsStatCards(summary)).toEqual([
      { label: "Total Capacity", value: "100" },
      { label: "Available Spots", value: "32" },
      { label: "Average Occupancy", value: "60.00%" },
      { label: "Maintenance", value: "8" },
    ]);
    expect(formatPercent(88.5)).toBe("88.50%");
    expect(getTrendWidth({ ...summary.occupancyTrends[0], occupancyRate: 140 })).toBe("100%");
    expect(getUtilisationWidth({ ...summary.zoneUtilisation[0], utilisationRate: -5 })).toBe("0%");
    expect(getTopPeakHours(summary.peakHours, 1)).toEqual([summary.peakHours[0]]);
    expect(formatAnalyticsTime("2026-05-20T08:00:00.000Z")).toContain("20 May");
  });

  it("surfaces analytics API errors clearly", () => {
    expect(
      getAnalyticsErrorMessage(
        new ApiError(400, {
          error: "Analytics request is invalid.",
          issues: ["Range must be one of: today, week, month."],
        }),
      ),
    ).toBe("Range must be one of: today, week, month.");
    expect(getAnalyticsErrorMessage(new ApiError(403, { error: "Forbidden." }))).toBe(
      "Forbidden.",
    );
    expect(getAnalyticsErrorMessage(new ApiResponseFormatError(404))).toContain(
      "Rebuild and restart",
    );
    expect(getAnalyticsErrorMessage(new Error("network"))).toContain(
      "Unable to load admin analytics",
    );
  });

  it("loads analytics summary with bearer authorization", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ summary })) as unknown as typeof fetch;
    const analyticsApi = createAnalyticsApi(createTestClient(fetchImpl));

    await analyticsApi.getSummary("week");

    const fetchCall = vi.mocked(fetchImpl).mock.calls[0] as unknown as Parameters<typeof fetch>;
    const headers = fetchCall[1]?.headers as Headers;
    const url = new URL(fetchCall[0] as string, "http://localhost");

    expect(url.pathname).toBe("/api/admin/analytics/summary");
    expect(url.searchParams.get("range")).toBe("week");
    expect(fetchCall[1]?.method).toBe("GET");
    expect(headers.get("authorization")).toBe("Bearer analytics-token");
  });

  it("loads split analytics endpoints with bearer authorization", async () => {
    const fetchImpl = vi.fn(async (url) => {
      const path = new URL(url as string, "http://localhost").pathname;

      if (path.endsWith("/occupancy-trends")) {
        return jsonResponse({ occupancyTrends: summary.occupancyTrends });
      }

      if (path.endsWith("/peak-hours")) {
        return jsonResponse({ peakHours: summary.peakHours });
      }

      return jsonResponse({ zoneUtilisation: summary.zoneUtilisation });
    }) as unknown as typeof fetch;
    const analyticsApi = createAnalyticsApi(createTestClient(fetchImpl));

    await analyticsApi.getOccupancyTrends("month");
    await analyticsApi.getPeakHours("month");
    await analyticsApi.getZoneUtilisation();

    const calls = vi.mocked(fetchImpl).mock.calls as unknown as Array<Parameters<typeof fetch>>;

    expect(new URL(calls[0][0] as string, "http://localhost").pathname).toBe(
      "/api/admin/analytics/occupancy-trends",
    );
    expect(new URL(calls[1][0] as string, "http://localhost").pathname).toBe(
      "/api/admin/analytics/peak-hours",
    );
    expect(calls[2][0]).toBe("/api/admin/analytics/zone-utilisation");
    for (const call of calls) {
      const headers = call[1]?.headers as Headers;

      expect(headers.get("authorization")).toBe("Bearer analytics-token");
    }
  });
});
