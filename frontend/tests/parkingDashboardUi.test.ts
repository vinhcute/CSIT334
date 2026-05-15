import { createElement } from "react";
import { describe, expect, it } from "vitest";
import type { OccupancySummary, ZoneOccupancySummary } from "../src/services/occupancyApi.js";
import {
  ParkingDashboardPage,
  buildDashboardStats,
  getCampusOccupancyRate,
  getParkingDashboardErrorMessage,
  getZoneAvailabilityLabel,
  getZoneAvailabilityTone,
  getZoneAvailablePercentage,
  hasDashboardAvailability,
} from "../src/features/parking/ParkingDashboardPage.js";
import { ApiError, ApiResponseFormatError } from "../src/services/apiClient.js";

const openZone: ZoneOccupancySummary = {
  zoneId: "zone-open",
  name: "North Lot",
  description: "Primary student parking",
  capacity: 20,
  distanceFromEntryMeters: 120,
  displayOrder: 1,
  availableSpots: 12,
  occupiedSpots: 6,
  reservedSpots: 2,
  maintenanceRequiredSpots: 0,
  occupancyRate: "40.00",
};

const limitedZone: ZoneOccupancySummary = {
  ...openZone,
  zoneId: "zone-limited",
  availableSpots: 5,
  occupiedSpots: 14,
  reservedSpots: 1,
  occupancyRate: "75.00",
};

const fullZone: ZoneOccupancySummary = {
  ...openZone,
  zoneId: "zone-full",
  availableSpots: 2,
  occupiedSpots: 17,
  reservedSpots: 1,
  occupancyRate: "90.00",
};

const summary: OccupancySummary = {
  totalCapacity: 40,
  totalAvailableSpots: 17,
  totalOccupiedSpots: 20,
  totalReservedSpots: 3,
  zones: [openZone, limitedZone],
};

describe("parking dashboard availability UI rules", () => {
  it("exports a dashboard component for driver and admin dashboard routes", () => {
    const element = createElement(ParkingDashboardPage);

    expect(element.type).toBe(ParkingDashboardPage);
  });

  it("builds campus capacity and availability stat cards without booking panels", () => {
    const stats = buildDashboardStats(summary);

    expect(stats).toEqual([
      { label: "Total Capacity", value: "40" },
      { label: "Available Spots", value: "17" },
      { label: "Occupied", value: "20" },
      { label: "Reserved", value: "3" },
    ]);
    expect(stats.map((stat) => stat.label)).not.toContain("Active Bookings");
    expect(stats.map((stat) => stat.label)).not.toContain("Recommendations");
  });

  it("detects loading-ready data and empty availability states", () => {
    expect(hasDashboardAvailability(summary)).toBe(true);
    expect(
      hasDashboardAvailability({
        totalCapacity: 0,
        totalAvailableSpots: 0,
        totalOccupiedSpots: 0,
        totalReservedSpots: 0,
        zones: [],
      }),
    ).toBe(false);
  });

  it("calculates campus occupancy and zone availability labels", () => {
    expect(getCampusOccupancyRate(summary)).toBe("58%");
    expect(getZoneAvailablePercentage(openZone)).toBe(60);
    expect(getZoneAvailabilityTone(openZone)).toBe("open");
    expect(getZoneAvailabilityLabel(openZone)).toBe("High availability");
    expect(getZoneAvailabilityTone(limitedZone)).toBe("limited");
    expect(getZoneAvailabilityLabel(limitedZone)).toBe("Limited availability");
    expect(getZoneAvailabilityTone(fullZone)).toBe("full");
    expect(getZoneAvailabilityLabel(fullZone)).toBe("Low availability");
  });

  it("surfaces occupancy API errors clearly", () => {
    expect(
      getParkingDashboardErrorMessage(new ApiError(401, { error: "Authentication required." })),
    ).toBe("Authentication required.");
    expect(getParkingDashboardErrorMessage(new ApiResponseFormatError(404))).toContain(
      "Rebuild and restart",
    );
    expect(getParkingDashboardErrorMessage(new Error("network"))).toContain(
      "Unable to load parking availability",
    );
  });
});
