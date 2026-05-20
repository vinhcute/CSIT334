import { describe, expect, it } from "vitest";
import { ApiError, ApiResponseFormatError } from "../src/services/apiClient.js";
import type { ParkingZone } from "../src/services/parkingZonesApi.js";
import type { ZoneOccupancySummary } from "../src/services/occupancyApi.js";
import type { PredictiveAvailabilityResult } from "../src/services/predictiveAvailabilityApi.js";
import {
  buildPredictionZoneOptions,
  createDefaultPredictionTargetTime,
  formatPredictionConfidence,
  formatPredictionOccupancy,
  getPredictionErrorMessage,
  getPredictionValidationError,
  toDateTimeLocalValue,
} from "../src/features/parking/ParkingDashboardPage.js";

const parkingZones: ParkingZone[] = [
  {
    id: "zone-b",
    zoneCode: "S",
    name: "South Zone",
    description: null,
    capacity: 80,
    distanceFromEntryMeters: 200,
    displayOrder: 2,
    createdAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
  },
  {
    id: "zone-a",
    zoneCode: "N",
    name: "North Zone",
    description: null,
    capacity: 100,
    distanceFromEntryMeters: 120,
    displayOrder: 1,
    createdAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
  },
];

const occupancyZones: ZoneOccupancySummary[] = [
  {
    zoneId: "zone-c",
    name: "Fallback Zone",
    description: "Fallback option",
    capacity: 30,
    distanceFromEntryMeters: null,
    displayOrder: 3,
    availableSpots: 12,
    occupiedSpots: 16,
    reservedSpots: 2,
    maintenanceRequiredSpots: 0,
    occupancyRate: "60.00",
  },
];

const prediction: PredictiveAvailabilityResult = {
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
};

describe("predictive availability dashboard UI rules", () => {
  it("builds prediction zone choices from parking zone API data first", () => {
    expect(buildPredictionZoneOptions(parkingZones, occupancyZones)).toEqual([
      { id: "zone-a", name: "North Zone" },
      { id: "zone-b", name: "South Zone" },
    ]);
  });

  it("falls back to occupancy zones when parking zone API data is empty", () => {
    expect(buildPredictionZoneOptions([], occupancyZones)).toEqual([
      { id: "zone-c", name: "Fallback Zone" },
    ]);
  });

  it("validates required zone and future target time", () => {
    const now = new Date("2026-05-20T08:00");

    expect(getPredictionValidationError("", "2026-05-20T09:00", now)).toContain(
      "Choose a parking zone",
    );
    expect(getPredictionValidationError("zone-a", "", now)).toContain(
      "Choose a future date",
    );
    expect(getPredictionValidationError("zone-a", "not-a-date", now)).toContain(
      "valid date",
    );
    expect(getPredictionValidationError("zone-a", "2026-05-20T08:00", now)).toContain(
      "future",
    );
    expect(getPredictionValidationError("zone-a", "2026-05-20T09:00", now)).toBeNull();
  });

  it("formats default local input values and prediction result labels", () => {
    expect(createDefaultPredictionTargetTime(new Date("2026-05-20T08:00:00.000Z"))).toMatch(
      /^2026-05-20T/,
    );
    expect(toDateTimeLocalValue(new Date("2026-05-20T08:00:00.000Z"))).toMatch(
      /^2026-05-20T/,
    );
    expect(formatPredictionOccupancy(prediction)).toBe("58.00% occupied");
    expect(formatPredictionConfidence("low")).toBe("Low confidence");
    expect(formatPredictionConfidence("medium")).toBe("Medium confidence");
    expect(formatPredictionConfidence("high")).toBe("High confidence");
  });

  it("surfaces predictive availability API errors clearly", () => {
    expect(
      getPredictionErrorMessage(
        new ApiError(400, {
          error: "Predictive availability input is invalid.",
          issues: ["Target time must be in the future."],
        }),
      ),
    ).toBe("Target time must be in the future.");
    expect(
      getPredictionErrorMessage(new ApiError(401, { error: "Authentication required." })),
    ).toBe("Authentication required.");
    expect(getPredictionErrorMessage(new ApiResponseFormatError(404))).toContain(
      "Rebuild and restart",
    );
    expect(getPredictionErrorMessage(new Error("network"))).toContain(
      "Unable to predict availability",
    );
  });
});
