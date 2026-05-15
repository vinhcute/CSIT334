import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { ApiError, ApiResponseFormatError } from "../src/services/apiClient.js";
import type { OccupancySummary } from "../src/services/occupancyApi.js";
import {
  AdminParkingInventoryPage,
  canViewAdminParkingInventory,
  getOptionalOccupancyWarningMessage,
  getParkingInventoryErrorMessage,
  getParkingSpotStatusClass,
  getParkingSpotStatusText,
  getZoneAvailableSpotText,
  getZoneOperationalStatus,
  hasParkingInventory,
  mergeZonesWithOccupancy,
  type ParkingInventoryViewModel,
} from "../src/features/admin/AdminParkingInventoryPage.js";
import type { SafeUser } from "../src/features/auth/authTypes.js";
import type { ParkingZone } from "../src/services/parkingZonesApi.js";

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

describe("admin parking inventory UI shell", () => {
  it("only allows administrators to view parking inventory", () => {
    expect(canViewAdminParkingInventory(adminUser)).toBe(true);
    expect(canViewAdminParkingInventory(driverUser)).toBe(false);
    expect(canViewAdminParkingInventory(null)).toBe(false);
  });

  it("exports a shell that can open on the zones or spots view", () => {
    const zonesElement = createElement(AdminParkingInventoryPage, {
      initialView: "zones",
    });
    const spotsElement = createElement(AdminParkingInventoryPage, {
      initialView: "spots",
    });

    expect(zonesElement.type).toBe(AdminParkingInventoryPage);
    expect(spotsElement.props.initialView).toBe("spots");
  });

  it("detects empty and ready inventory states from loaded data", () => {
    const emptyInventory: ParkingInventoryViewModel = {
      zones: [],
      spots: [],
      summary: null,
    };
    const readyInventory: ParkingInventoryViewModel = {
      zones: [
        {
          id: "zone-1",
          name: "Zone A",
          description: null,
          capacity: 10,
          distanceFromEntryMeters: null,
          displayOrder: 1,
          createdAt: "2026-05-15T00:00:00.000Z",
          updatedAt: "2026-05-15T00:00:00.000Z",
        },
      ],
      spots: [],
      summary: null,
    };

    expect(hasParkingInventory(emptyInventory)).toBe(false);
    expect(hasParkingInventory(readyInventory)).toBe(true);
  });

  it("merges zone metadata with occupancy counts for the read-only table", () => {
    const zones: ParkingZone[] = [
      {
        id: "zone-1",
        name: "Zone A",
        description: "North parking",
        capacity: 10,
        distanceFromEntryMeters: 120,
        displayOrder: 1,
        createdAt: "2026-05-15T00:00:00.000Z",
        updatedAt: "2026-05-15T00:00:00.000Z",
      },
    ];
    const summary: OccupancySummary = {
      totalCapacity: 10,
      totalAvailableSpots: 4,
      totalOccupiedSpots: 5,
      totalReservedSpots: 1,
      zones: [
        {
          zoneId: "zone-1",
          name: "Zone A",
          description: "North parking",
          capacity: 10,
          distanceFromEntryMeters: 120,
          displayOrder: 1,
          availableSpots: 4,
          occupiedSpots: 5,
          reservedSpots: 1,
          maintenanceRequiredSpots: 0,
          occupancyRate: "60.00",
        },
      ],
    };

    const [zone] = mergeZonesWithOccupancy(zones, summary);

    expect(zone.availableSpots).toBe(4);
    expect(zone.occupancyRate).toBe("60.00");
  });

  it("uses readable status labels and colour classes", () => {
    expect(getParkingSpotStatusText("available")).toBe("Available");
    expect(getParkingSpotStatusText("maintenanceRequired")).toBe("Maintenance");
    expect(getParkingSpotStatusClass("reserved")).toContain("parking-status-reserved");
  });

  it("surfaces backend API error messages clearly", () => {
    const apiError = new ApiError(409, {
      error: "Parking zone capacity cannot be reduced below existing spots.",
    });

    expect(getParkingInventoryErrorMessage(apiError)).toContain("capacity");
    expect(getParkingInventoryErrorMessage(new Error("network"))).toContain(
      "Unable to load parking inventory",
    );
    expect(getParkingInventoryErrorMessage(new TypeError("fetch failed"))).toContain(
      "http://127.0.0.1:3000",
    );
    expect(getParkingInventoryErrorMessage(new ApiResponseFormatError(404))).toContain(
      "Rebuild and restart",
    );
  });

  it("keeps inventory readable when occupancy summary is unavailable", () => {
    const zone: ParkingZone = {
      id: "zone-1",
      name: "Zone A",
      description: null,
      capacity: 10,
      distanceFromEntryMeters: null,
      displayOrder: 1,
      createdAt: "2026-05-15T00:00:00.000Z",
      updatedAt: "2026-05-15T00:00:00.000Z",
    };

    expect(getZoneAvailableSpotText(zone)).toBe("Not available");
    expect(getZoneOperationalStatus(zone)).toBe("Not available");
    expect(getOptionalOccupancyWarningMessage(new TypeError("fetch failed"))).toContain(
      "Zones and spots are still shown",
    );
  });
});
