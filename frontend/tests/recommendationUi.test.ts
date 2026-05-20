import { describe, expect, it } from "vitest";
import { ApiError, ApiResponseFormatError } from "../src/services/apiClient.js";
import type {
  RecommendationResponse,
  ZoneRecommendation,
} from "../src/services/recommendationsApi.js";
import {
  formatRecommendationAvailability,
  formatRecommendationDistance,
  getRecommendationErrorMessage,
  getRecommendationStatus,
} from "../src/features/parking/ParkingDashboardPage.js";

const recommendation: ZoneRecommendation = {
  type: "nearestAvailableZone",
  zoneId: "zone-a",
  zoneName: "North Zone",
  distanceFromEntryMeters: 125,
  displayOrder: 1,
  capacity: 20,
  availableSpots: 8,
  occupiedSpots: 9,
  reservedSpots: 2,
  maintenanceRequiredSpots: 1,
  occupancyRate: 55,
  reason: "8 available spots, 55.00% occupied, 125m from entry.",
};

describe("recommendation dashboard UI rules", () => {
  it("detects ready and empty smart suggestion states", () => {
    const ready: RecommendationResponse = {
      nearestAvailableZone: recommendation,
      leastCongestedZone: null,
      recommendations: [recommendation],
      generatedAt: "2026-05-20T00:00:00.000Z",
    };
    const empty: RecommendationResponse = {
      nearestAvailableZone: null,
      leastCongestedZone: null,
      recommendations: [],
      generatedAt: "2026-05-20T00:00:00.000Z",
    };

    expect(getRecommendationStatus(null)).toBe("idle");
    expect(getRecommendationStatus(ready)).toBe("ready");
    expect(getRecommendationStatus(empty)).toBe("empty");
  });

  it("formats recommendation availability and distance labels", () => {
    expect(formatRecommendationAvailability(recommendation)).toBe(
      "8 of 20 spots available",
    );
    expect(formatRecommendationDistance(recommendation)).toBe("125m from entry");
    expect(
      formatRecommendationDistance({
        ...recommendation,
        distanceFromEntryMeters: null,
      }),
    ).toBe("Distance unavailable");
  });

  it("surfaces recommendation API errors clearly", () => {
    expect(
      getRecommendationErrorMessage(new ApiError(401, { error: "Authentication required." })),
    ).toBe("Authentication required.");
    expect(
      getRecommendationErrorMessage(new ApiError(403, { error: "Forbidden." })),
    ).toBe("Forbidden.");
    expect(getRecommendationErrorMessage(new ApiResponseFormatError(404))).toContain(
      "Rebuild and restart",
    );
    expect(getRecommendationErrorMessage(new Error("network"))).toContain(
      "Unable to load smart suggestions",
    );
  });
});
